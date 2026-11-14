/**
 * 设计器状态机（框架无关内核）。
 *
 * 约束：纯 TS，不 import vue / react，不访问 window / document。
 * Vue 的 pinia store 与 React 的 useSyncExternalStore hook 都是它的薄包装，
 * 因此撤销/重做、拖拽落点、属性编辑、导入导出在两侧是同一份实现。
 *
 * 对外通过 getSnapshot() + subscribe() 暴露可订阅快照，符合 React 18+
 * useSyncExternalStore 的契约：快照引用只在状态真正变化时更新。
 */

import type { ActionSchema, DeviceType, NodeSchema, PageSchema } from "../schema/types";
import { createEmptyPage } from "../schema/types";
import type { ExternalDataSource } from "../data/external";
import type { VisibilityConfig } from "../visibility/types";
import { normalizeRules, type ValidationRule } from "../validation/rules";
import {
  cloneWithNewIds,
  countNodes,
  createNodeId,
  findLocation,
  getBreadcrumb,
  insertNode,
  moveNode,
  relocateNode,
  removeNode,
  type DropPosition,
  type NodeLocation,
} from "../schema/tree";
import { compactPage, toJSON } from "../schema/serialize";
import { createRegistry, type MaterialRegistry } from "../materials/registry";
import { MATERIALS } from "../materials/catalog";
import type { Material } from "../materials/types";
import { writeSpacing, type SpacingBox, type SpacingKey } from "../style/spacing";
import { getPageRepository, type PageRepository } from "./repo";

export type DragPayload = { kind: "new"; component: string } | { kind: "move"; id: string };

export interface DropHint {
  id: string | null;
  position: DropPosition;
}

/** 快照：组件直接读这些字段，不要自己再算一遍派生值 */
export interface DesignerState {
  page: PageSchema;
  selectedId: string | null;
  hoverId: string | null;
  selectedNode: NodeSchema | null;
  selectedLocation: NodeLocation | null;
  breadcrumb: NodeSchema[];
  nodeCount: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  loading: boolean;
  lastSavedAt: number;
  dropHint: DropHint | null;
  dragPayload: DragPayload | null;
  clipboard: NodeSchema | null;
}

export interface DesignerStoreOptions {
  /** 组件级仓储；不传回落全局仓储 */
  repository?: PageRepository | null;
  /** 初始物料目录；不传用 core 通用清单 */
  registry?: MaterialRegistry;
}

const MAX_HISTORY = 80;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class DesignerStore {
  private page: PageSchema = createEmptyPage();
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private history: string[] = [];
  private future: string[] = [];
  private dragPayloadValue: DragPayload | null = null;
  private dropHintValue: DropHint | null = null;
  private clipboardValue: NodeSchema | null = null;
  private lastSavedSnapshot = "";
  private lastSavedAtValue = 0;
  private loadingValue = false;
  private repositoryValue: PageRepository | null;
  private catalogValue: MaterialRegistry;
  private listeners = new Set<() => void>();
  private snapshot: DesignerState;

  private lastCoalesceKey: string | null = null;
  private lastCoalesceAt = 0;

  constructor(options: DesignerStoreOptions = {}) {
    this.repositoryValue = options.repository ?? null;
    this.catalogValue = options.registry ?? createRegistry(MATERIALS);
    this.snapshot = this.buildSnapshot(this.page);
  }

  /* ---------------- 订阅 ---------------- */

  getSnapshot = (): DesignerState => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private buildSnapshot(page: PageSchema): DesignerState {
    const location = this.selectedId ? findLocation(page.children, this.selectedId) : null;
    return {
      page,
      selectedId: this.selectedId,
      hoverId: this.hoverId,
      selectedNode: location?.node ?? null,
      selectedLocation: location,
      breadcrumb: this.selectedId ? getBreadcrumb(page.children, this.selectedId) : [],
      nodeCount: countNodes(page.children),
      dirty: JSON.stringify(page) !== this.lastSavedSnapshot,
      canUndo: this.history.length > 0,
      canRedo: this.future.length > 0,
      loading: this.loadingValue,
      lastSavedAt: this.lastSavedAtValue,
      dropHint: this.dropHintValue,
      dragPayload: this.dragPayloadValue,
      clipboard: this.clipboardValue,
    };
  }

  /** rebuildPage=true 时生成新的 page 引用，保证 React/Vue 的引用比较能感知变更 */
  private emit(rebuildPage = true): void {
    const page = rebuildPage ? clone(this.page) : this.snapshot.page;
    this.snapshot = this.buildSnapshot(page);
    for (const listener of this.listeners) listener();
  }

  /* ---------------- 物料目录 ---------------- */

  get registry(): MaterialRegistry {
    return this.catalogValue;
  }

  setMaterialCatalog(next: MaterialRegistry): void {
    this.catalogValue = next;
  }

  /** 显式传物料数组（React 侧从 UiAdapter.materials 构造目录时用） */
  setMaterials(next: Material[]): void {
    this.catalogValue = createRegistry(next?.length ? next : MATERIALS);
  }

  materialOf(component: string): Material | undefined {
    return this.catalogValue.get(component);
  }

  /* ---------------- 历史 ---------------- */

  private pushHistory(coalesceKey?: string): void {
    const now = Date.now();
    if (coalesceKey && this.lastCoalesceKey === coalesceKey && now - this.lastCoalesceAt < 800) {
      this.lastCoalesceAt = now;
      return;
    }
    this.lastCoalesceKey = coalesceKey ?? null;
    this.lastCoalesceAt = now;
    this.history.push(JSON.stringify(this.page));
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.future = [];
  }

  /** 修改 page 的统一入口；mutator 返回 false 视为无操作，撤销栈不留下空步 */
  private mutatePage(mutate: (draft: PageSchema) => boolean | void, coalesceKey?: string): void {
    const before = this.history.length;
    this.pushHistory(coalesceKey);
    const ok = mutate(this.page);
    if (ok === false && this.history.length > before) this.history.pop();
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) return;
    this.future.push(JSON.stringify(this.page));
    this.page = JSON.parse(previous) as PageSchema;
    this.selectedId = null;
    this.emit();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.history.push(JSON.stringify(this.page));
    this.page = JSON.parse(next) as PageSchema;
    this.selectedId = null;
    this.emit();
  }

  /* ---------------- 载入 / 保存 ---------------- */

  setRepository(next: PageRepository | null): void {
    this.repositoryValue = next;
  }

  private repo(): PageRepository {
    return this.repositoryValue ?? getPageRepository();
  }

  load(id: string): boolean {
    this.loadingValue = true;
    const record = this.repo().get(id);
    this.loadingValue = false;
    if (!record) return false;

    this.page = clone(record.schema);
    this.page.children = this.page.children ?? [];
    this.selectedId = null;
    this.history = [];
    this.future = [];
    this.lastSavedSnapshot = JSON.stringify(this.page);
    this.lastSavedAtValue = record.updatedAt;
    this.emit();
    return true;
  }

  setPage(next: PageSchema): void {
    this.page = clone(next);
    this.selectedId = null;
    this.lastSavedSnapshot = JSON.stringify(this.page);
    this.history = [];
    this.future = [];
    this.emit();
  }

  save(): boolean {
    try {
      const compact = compactPage(this.page);
      this.repo().save(compact);
      this.page = clone(compact);
      this.lastSavedSnapshot = JSON.stringify(this.page);
      this.lastSavedAtValue = Date.now();
      this.emit();
      return true;
    } catch (error) {
      // core 不碰 console 之外的宿主能力；异常原样抛给 UI 层提示
      console.warn("[design-core] 保存失败", error);
      throw error;
    }
  }

  setTitle(title: string): void {
    this.mutatePage((page) => {
      page.meta = { ...(page.meta ?? {}), title };
    }, "page:title");
    this.emit();
  }

  setDevice(device: DeviceType): void {
    this.mutatePage((page) => {
      page.meta = { ...(page.meta ?? {}), device };
    });
    this.emit();
  }

  /** 页面级字段整体替换（state / dataSource 等），用于设置面板 */
  patchPage(patch: Partial<PageSchema>): void {
    this.mutatePage((page) => {
      Object.assign(page, patch);
    }, `page:${Object.keys(patch).join(",")}`);
    this.emit();
  }

  /* ---------------- 节点操作 ---------------- */

  createNode(component: string): NodeSchema | null {
    const material = this.materialOf(component);
    if (!material) return null;
    const node: NodeSchema = { id: createNodeId(), component, props: {} };
    if (material.acceptsChildren) node.children = [];
    return node;
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.emit(false);
  }

  hover(id: string | null): void {
    if (this.hoverId === id) return;
    this.hoverId = id;
    this.emit(false);
  }

  addNode(component: string, targetId: string | null = null, position: DropPosition = "after"): void {
    const node = this.createNode(component);
    if (!node) return;
    const accepts = (c: string) => Boolean(this.materialOf(c)?.acceptsChildren);
    this.mutatePage((page) => insertNode(page.children, node, targetId, position, accepts));
    this.selectedId = node.id;
    this.emit();
  }

  /** 点击物料：优先放进当前选中的容器，否则追加到根 */
  addNodeSmart(component: string): void {
    const material = this.materialOf(component);
    if (!material) return;
    const location = this.selectedId ? findLocation(this.page.children, this.selectedId) : null;
    const target = location?.node ?? null;
    if (target && this.materialOf(target.component)?.acceptsChildren) {
      this.addNode(component, target.id, "inside");
      return;
    }
    this.addNode(component, target?.id ?? null, "after");
  }

  relocate(id: string, targetId: string | null, position: DropPosition): void {
    const accepts = (c: string) => Boolean(this.materialOf(c)?.acceptsChildren);
    this.mutatePage((page) => relocateNode(page.children, id, targetId, position, accepts));
    this.emit();
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    const location = findLocation(this.page.children, this.selectedId);
    const nextSelection = location?.parent?.id ?? null;
    const id = this.selectedId;
    this.mutatePage((page) => {
      removeNode(page.children, id);
    });
    this.selectedId = nextSelection;
    this.emit();
  }

  duplicateSelected(): void {
    const location = this.selectedId ? findLocation(this.page.children, this.selectedId) : null;
    if (!location) return;
    const copy = cloneWithNewIds(location.node);
    this.mutatePage(() => {
      location.list.splice(location.index + 1, 0, copy);
    });
    this.selectedId = copy.id;
    this.emit();
  }

  moveSelected(delta: number): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => moveNode(page.children, id, delta));
    this.emit();
  }

  copySelected(): void {
    const location = this.selectedId ? findLocation(this.page.children, this.selectedId) : null;
    if (!location) return;
    this.clipboardValue = clone(location.node);
    this.emit(false);
  }

  pasteNode(): void {
    if (!this.clipboardValue) return;
    const location = this.selectedId ? findLocation(this.page.children, this.selectedId) : null;
    const copy = cloneWithNewIds(this.clipboardValue);
    const accepts = (c: string) => Boolean(this.materialOf(c)?.acceptsChildren);
    this.mutatePage((page) => {
      if (location && accepts(location.node.component)) {
        insertNode(page.children, copy, location.node.id, "inside", accepts);
      } else if (location) {
        location.list.splice(location.index + 1, 0, copy);
      } else {
        page.children.push(copy);
      }
    });
    this.selectedId = copy.id;
    this.emit();
  }

  /* ---------------- 属性编辑 ---------------- */

  updateProp(key: string, value: unknown): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      node.props = node.props ?? {};
      const defaultValue = this.materialOf(node.component)?.defaultProps?.[key];
      const shouldDrop =
        value === undefined ||
        (defaultValue !== undefined && JSON.stringify(defaultValue) === JSON.stringify(value));
      if (shouldDrop) delete node.props[key];
      else node.props[key] = value;
    }, `prop:${id}:${key}`);
    this.emit();
  }

  /**
   * 更新指定节点的属性（跨节点写入）。
   * 外部数据源的「响应映射到某个元素」需要改的不是当前选中节点，所以单独开一个入口。
   */
  updateNodeProp(nodeId: string, key: string, value: unknown): void {
    this.mutatePage((page) => {
      const node = findLocation(page.children, nodeId)?.node;
      if (!node) return false;
      node.props = node.props ?? {};
      const defaultValue = this.materialOf(node.component)?.defaultProps?.[key];
      const shouldDrop =
        value === undefined ||
        (defaultValue !== undefined && JSON.stringify(defaultValue) === JSON.stringify(value));
      if (shouldDrop) delete node.props[key];
      else node.props[key] = value;
    }, `prop:${nodeId}:${key}`);
    this.emit();
  }

  updateStyle(key: string, value: unknown): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      node.style = node.style ?? {};
      if (value === "" || value === undefined || value === null) delete node.style[key];
      else node.style[key] = value as string | number;
    }, `style:${id}:${key}`);
    this.emit();
  }

  /** 四边相等收敛成简写、否则展开成长写，见 core 的 writeSpacing */
  updateSpacing(key: SpacingKey, box: SpacingBox): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      const style: Record<string, unknown> = { ...(node.style ?? {}) };
      writeSpacing(style, key, box);
      node.style = Object.keys(style).length ? (style as NodeSchema["style"]) : undefined;
    }, `box:${id}:${key}`);
    this.emit();
  }

  /** 写入校验规则（整组替换），顺手清掉老 Schema 的 props.required */
  setRules(rules: ValidationRule[]): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      if (node.props && "required" in node.props) delete node.props.required;
      const normalized = normalizeRules(rules);
      if (normalized.length) node.rules = normalized;
      else delete node.rules;
    }, `rules:${id}`);
    this.emit();
  }

  setEventActions(name: string, actions: ActionSchema[]): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      node.events = node.events ?? {};
      if (!actions.length) delete node.events[name];
      else node.events[name] = actions;
    }, `event:${id}:${name}`);
    this.emit();
  }

  /**
   * 写入 / 更新页面级外部数据源配置（rg4KCt）。
   * 配置集中在 page.externalSources，键为 source.id；节点通过 externalRef 引用，
   * 避免同一份取数配置在多个元素上重复书写。
   */
  upsertExternalSource(source: ExternalDataSource): void {
    this.mutatePage((page) => {
      page.externalSources = page.externalSources ?? {};
      page.externalSources[source.id] = clone(source);
    }, `external:${source.id}`);
    this.emit();
  }

  /** 删除页面级外部数据源配置（按 id） */
  removeExternalSource(sourceId: string): void {
    this.mutatePage((page) => {
      if (!page.externalSources) return false;
      delete page.externalSources[sourceId];
      if (!Object.keys(page.externalSources).length) delete page.externalSources;
    }, `external-del:${sourceId}`);
    this.emit();
  }

  /**
   * 设置 / 清除节点的外部数据源引用（externalRef）。
   * 传 undefined 表示移除该节点的引用（源本身是否删除由调用方决定）。
   */
  setNodeExternalRef(nodeId: string, ref: string | undefined): void {
    this.mutatePage((page) => {
      const node = findLocation(page.children, nodeId)?.node;
      if (!node) return false;
      if (ref) node.externalRef = ref;
      else delete node.externalRef;
    }, `external-ref:${nodeId}`);
    this.emit();
  }

  setDirective(name: "show" | "if" | "for", value: string): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      const directives = (node.directives ?? []).filter((d) => d.name !== name);
      if (value.trim()) directives.push({ name, value: value.trim() });
      node.directives = directives.length ? directives : undefined;
    }, `directive:${id}:${name}`);
    this.emit();
  }

  /**
   * 写入节点的显示 / 隐藏条件（r5u4Ul）。
   * 传 undefined 表示移除该节点的全部条件配置。
   */
  setVisibility(config: VisibilityConfig | undefined): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.mutatePage((page) => {
      const node = findLocation(page.children, id)?.node;
      if (!node) return false;
      if (!config) delete node.visibility;
      else node.visibility = clone(config);
    }, `visibility:${id}`);
    this.emit();
  }

  addDataSourceEntry(key: string, json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("dataSource 必须是合法 JSON");
    }
    this.mutatePage((page) => {
      page.dataSource = page.dataSource ?? {};
      Object.assign(page.dataSource, { [key]: parsed });
    });
    this.emit();
  }

  /* ---------------- 拖拽 ---------------- */

  beginDrag(payload: DragPayload): void {
    this.dragPayloadValue = payload;
    this.emit(false);
  }

  setDropHint(hint: DropHint | null): void {
    this.dropHintValue = hint;
    this.emit(false);
  }

  clearDrag(): void {
    this.dragPayloadValue = null;
    this.dropHintValue = null;
    this.emit(false);
  }

  applyDrop(hint: DropHint | null): void {
    const payload = this.dragPayloadValue;
    this.dragPayloadValue = null;
    this.dropHintValue = null;
    if (!payload) {
      this.emit(false);
      return;
    }
    if (payload.kind === "new") {
      this.addNode(payload.component, hint?.id ?? null, hint?.position ?? "inside");
      return;
    }
    this.relocate(payload.id, hint?.id ?? null, hint?.position ?? "inside");
  }

  /* ---------------- 导入导出 ---------------- */

  exportJSON(): string {
    return toJSON(this.page);
  }

  replaceWith(next: PageSchema): void {
    this.pushHistory();
    this.page = clone(next);
    this.selectedId = null;
    this.emit();
  }

  clear(): void {
    this.mutatePage((page) => {
      page.children = [];
    });
    this.selectedId = null;
    this.emit();
  }
}
