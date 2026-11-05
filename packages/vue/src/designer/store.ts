import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { ActionSchema, DeviceType, NodeSchema, PageSchema, ValidationRule } from "@x-ac/design-core";
import { createEmptyPage, normalizeRules } from "@x-ac/design-core";
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
} from "@x-ac/design-core";
import { getMaterial } from "@x-ac/design-core";
import { compactPage, toJSON } from "@x-ac/design-core";
import { writeSpacing, type SpacingBox, type SpacingKey } from "@x-ac/design-core";
import { getPageRepository } from "../persistence/repo";

export type DragPayload = { kind: "new"; component: string } | { kind: "move"; id: string };

export interface DropHint {
  id: string | null;
  position: DropPosition;
}

const MAX_HISTORY = 80;

export const useDesignerStore = defineStore("designer", () => {
  const page = ref<PageSchema>(createEmptyPage());
  const selectedId = ref<string | null>(null);
  const history = ref<string[]>([]);
  const future = ref<string[]>([]);
  const dragPayload = ref<DragPayload | null>(null);
  const dropHint = ref<DropHint | null>(null);
  const clipboard = ref<NodeSchema | null>(null);
  const lastSavedSnapshot = ref("");
  const lastSavedAt = ref(0);
  const loading = ref(false);

  const snapshot = computed(() => JSON.stringify(page.value));
  const dirty = computed(() => snapshot.value !== lastSavedSnapshot.value);
  const canUndo = computed(() => history.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);
  const nodeCount = computed(() => countNodes(page.value.children));
  const selectedLocation = computed(() =>
    selectedId.value ? findLocation(page.value.children, selectedId.value) : null,
  );
  const selectedNode = computed(() => selectedLocation.value?.node ?? null);
  const breadcrumb = computed(() =>
    selectedId.value ? getBreadcrumb(page.value.children, selectedId.value) : [],
  );

  /* ---------------- 历史 ---------------- */

  let lastCoalesceKey: string | null = null;
  let lastCoalesceAt = 0;

  function pushHistory(coalesceKey?: string): void {
    const now = Date.now();
    if (coalesceKey && lastCoalesceKey === coalesceKey && now - lastCoalesceAt < 800) {
      lastCoalesceAt = now;
      return;
    }
    lastCoalesceKey = coalesceKey ?? null;
    lastCoalesceAt = now;
    history.value.push(JSON.stringify(page.value));
    if (history.value.length > MAX_HISTORY) history.value.shift();
    future.value = [];
  }

  function undo(): void {
    const previous = history.value.pop();
    if (!previous) return;
    future.value.push(JSON.stringify(page.value));
    page.value = JSON.parse(previous) as PageSchema;
    selectedId.value = null;
  }

  function redo(): void {
    const next = future.value.pop();
    if (!next) return;
    history.value.push(JSON.stringify(page.value));
    page.value = JSON.parse(next) as PageSchema;
    selectedId.value = null;
  }

  /* ---------------- 载入 / 保存 ---------------- */

  function load(id: string): boolean {
    loading.value = true;
    const record = getPageRepository().get(id);
    loading.value = false;
    if (!record) return false;

    page.value = JSON.parse(JSON.stringify(record.schema)) as PageSchema;
    page.value.children = page.value.children ?? [];
    selectedId.value = null;
    history.value = [];
    future.value = [];
    lastSavedSnapshot.value = JSON.stringify(page.value);
    lastSavedAt.value = record.updatedAt;
    return true;
  }

  function setPage(next: PageSchema): void {
    page.value = next;
    selectedId.value = null;
    lastSavedSnapshot.value = JSON.stringify(next);
    history.value = [];
    future.value = [];
  }

  function save(): boolean {
    try {
      const compact = compactPage(page.value);
      getPageRepository().save(compact);
      page.value = JSON.parse(JSON.stringify(compact)) as PageSchema;
      lastSavedSnapshot.value = JSON.stringify(page.value);
      lastSavedAt.value = Date.now();
      return true;
    } catch (error) {
      console.warn("[vue-design] 保存失败", error);
      throw error;
    }
  }

  function setTitle(title: string): void {
    pushHistory("page:title");
    page.value.meta = { ...(page.value.meta ?? {}), title };
  }

  function setDevice(device: DeviceType): void {
    pushHistory();
    page.value.meta = { ...(page.value.meta ?? {}), device };
  }

  /** 页面级字段整体替换（state / dataSource 等），用于设置面板 */
  function patchPage(patch: Partial<PageSchema>): void {
    pushHistory(`page:${Object.keys(patch).join(",")}`);
    page.value = { ...page.value, ...patch };
  }

  /* ---------------- 节点操作 ---------------- */

  function createNode(component: string): NodeSchema | null {
    const material = getMaterial(component);
    if (!material) return null;
    const node: NodeSchema = { id: createNodeId(), component, props: {} };
    if (material.acceptsChildren) node.children = [];
    return node;
  }

  function select(id: string | null): void {
    selectedId.value = id;
  }

  function addNode(component: string, targetId: string | null = null, position: DropPosition = "after"): void {
    const node = createNode(component);
    if (!node) return;
    pushHistory();
    insertNode(page.value.children, node, targetId, position, (c) => Boolean(getMaterial(c)?.acceptsChildren));
    selectedId.value = node.id;
  }

  /** 点击物料：优先放进当前选中的容器，否则追加到根 */
  function addNodeSmart(component: string): void {
    const material = getMaterial(component);
    if (!material) return;
    const target = selectedNode.value;
    if (target && getMaterial(target.component)?.acceptsChildren) {
      addNode(component, target.id, "inside");
      return;
    }
    addNode(component, target?.id ?? null, "after");
  }

  function relocate(id: string, targetId: string | null, position: DropPosition): void {
    pushHistory();
    const moved = relocateNode(
      page.value.children,
      id,
      targetId,
      position,
      (c) => Boolean(getMaterial(c)?.acceptsChildren),
    );
    if (!moved) history.value.pop();
  }

  function removeSelected(): void {
    if (!selectedId.value) return;
    const location = selectedLocation.value;
    const nextSelection = location?.parent?.id ?? null;
    pushHistory();
    removeNode(page.value.children, selectedId.value);
    selectedId.value = nextSelection;
  }

  function duplicateSelected(): void {
    const node = selectedNode.value;
    const location = selectedLocation.value;
    if (!node || !location) return;
    pushHistory();
    const copy = cloneWithNewIds(node);
    location.list.splice(location.index + 1, 0, copy);
    selectedId.value = copy.id;
  }

  function moveSelected(delta: number): void {
    if (!selectedId.value) return;
    pushHistory();
    if (!moveNode(page.value.children, selectedId.value, delta)) history.value.pop();
  }

  function copySelected(): void {
    if (!selectedNode.value) return;
    clipboard.value = JSON.parse(JSON.stringify(selectedNode.value)) as NodeSchema;
  }

  function pasteNode(): void {
    if (!clipboard.value) return;
    const location = selectedLocation.value;
    pushHistory();
    const copy = cloneWithNewIds(clipboard.value);
    if (location && getMaterial(location.node.component)?.acceptsChildren) {
      insertNode(page.value.children, copy, location.node.id, "inside", (c) => Boolean(getMaterial(c)?.acceptsChildren));
    } else if (location) {
      location.list.splice(location.index + 1, 0, copy);
    } else {
      page.value.children.push(copy);
    }
    selectedId.value = copy.id;
  }

  /* ---------------- 属性编辑 ---------------- */

  function updateProp(key: string, value: unknown): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`prop:${node.id}:${key}`);
    node.props = node.props ?? {};

    const material = getMaterial(node.component);
    const defaultValue = material?.defaultProps?.[key];
    const shouldDrop =
      value === undefined ||
      (defaultValue !== undefined && JSON.stringify(defaultValue) === JSON.stringify(value));

    if (shouldDrop) delete node.props[key];
    else node.props[key] = value;
  }

  function updateStyle(key: string, value: unknown): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`style:${node.id}:${key}`);
    node.style = node.style ?? {};
    if (value === "" || value === undefined || value === null) delete node.style[key];
    else node.style[key] = value as string | number;
  }

  /**
   * 通用间距编辑：所有物料都走同一条路径，四边相等收敛成简写、
   * 否则展开成长写，见 core 的 writeSpacing。
   */
  function updateSpacing(key: SpacingKey, box: SpacingBox): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`box:${node.id}:${key}`);
    const style: Record<string, unknown> = { ...(node.style ?? {}) };
    writeSpacing(style, key, box);
    node.style = Object.keys(style).length ? (style as NodeSchema["style"]) : undefined;
  }

  /**
   * 写入校验规则（整组替换）。
   * 老 Schema 用 props.required 表达必填，这里顺手清掉，避免两处都能控制必填。
   */
  function setRules(rules: ValidationRule[]): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`rules:${node.id}`);
    if (node.props && "required" in node.props) delete node.props.required;
    const normalized = normalizeRules(rules);
    if (normalized.length) node.rules = normalized;
    else delete node.rules;
  }

  function setEventActions(name: string, actions: ActionSchema[]): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`event:${node.id}:${name}`);
    node.events = node.events ?? {};
    if (!actions.length) delete node.events[name];
    else node.events[name] = actions;
  }

  function setDirective(name: "show" | "if" | "for", value: string): void {
    const node = selectedNode.value;
    if (!node) return;
    pushHistory(`directive:${node.id}:${name}`);
    const directives = (node.directives ?? []).filter((d) => d.name !== name);
    if (value.trim()) directives.push({ name, value: value.trim() });
    node.directives = directives.length ? directives : undefined;
  }

  function addDataSourceEntry(key: string, json: string): void {
    pushHistory();
    page.value.dataSource = page.value.dataSource ?? {};
    try {
      page.value.dataSource[key] = JSON.parse(json);
    } catch {
      history.value.pop();
      throw new Error("dataSource 必须是合法 JSON");
    }
  }

  /* ---------------- 拖拽 ---------------- */

  function beginDrag(payload: DragPayload): void {
    dragPayload.value = payload;
  }

  function setDropHint(hint: DropHint | null): void {
    dropHint.value = hint;
  }

  function clearDrag(): void {
    dragPayload.value = null;
    dropHint.value = null;
  }

  function applyDrop(hint: DropHint | null): void {
    const payload = dragPayload.value;
    clearDrag();
    if (!payload) return;
    if (payload.kind === "new") {
      addNode(payload.component, hint?.id ?? null, hint?.position ?? "inside");
      return;
    }
    relocate(payload.id, hint?.id ?? null, hint?.position ?? "inside");
  }

  /* ---------------- 导入导出 ---------------- */

  function exportJSON(): string {
    return toJSON(page.value);
  }

  function replaceWith(next: PageSchema): void {
    pushHistory();
    page.value = next;
    selectedId.value = null;
  }

  function clear(): void {
    pushHistory();
    page.value.children = [];
    selectedId.value = null;
  }

  return {
    page,
    selectedId,
    selectedNode,
    selectedLocation,
    breadcrumb,
    nodeCount,
    dirty,
    canUndo,
    canRedo,
    loading,
    lastSavedAt,
    dropHint,
    dragPayload,
    clipboard,
    undo,
    redo,
    load,
    save,
    setPage,
    setTitle,
    setDevice,
    patchPage,
    createNode,
    select,
    addNode,
    addNodeSmart,
    relocate,
    removeSelected,
    duplicateSelected,
    moveSelected,
    copySelected,
    pasteNode,
    updateProp,
    updateStyle,
    updateSpacing,
    setRules,
    setEventActions,
    setDirective,
    addDataSourceEntry,
    beginDrag,
    setDropHint,
    clearDrag,
    applyDrop,
    exportJSON,
    replaceWith,
    clear,
  };
});
