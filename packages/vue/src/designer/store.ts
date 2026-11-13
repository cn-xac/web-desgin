/**
 * Vue 设计器 store：core 状态机的 pinia 薄包装。
 *
 * 所有状态与操作都在 @x-ac/web-design-core 的 DesignerStore 里，React 侧用
 * useSyncExternalStore 消费同一个内核。这里只做「快照 → computed」的适配，
 * 对外 API 与改造前完全一致，组件与测试无需改动。
 *
 * 订阅在 pinia 的 effect scope 结束时自动解除，避免多实例泄漏。
 */
import { computed, onScopeDispose, shallowRef } from "vue";
import { defineStore } from "pinia";
import { DesignerStore } from "@x-ac/web-design-core";
import type {
  ActionSchema,
  DesignerState,
  DeviceType,
  ExternalDataSource,
  PageSchema,
  PageRepository,
  ValidationRule,
} from "@x-ac/web-design-core";
import type { MaterialRegistry } from "@x-ac/web-design-core";
import type { DropPosition } from "@x-ac/web-design-core";
import type { SpacingBox, SpacingKey } from "@x-ac/web-design-core";

export type { DragPayload, DropHint } from "@x-ac/web-design-core";

export const useDesignerStore = defineStore("designer", () => {
  const kernel = new DesignerStore();
  const state = shallowRef<DesignerState>(kernel.getSnapshot());
  const unsubscribe = kernel.subscribe(() => {
    state.value = kernel.getSnapshot();
  });
  onScopeDispose(unsubscribe);

  /* ---------------- 状态（保持原来的字段名与解包语义） ---------------- */

  const page = computed(() => state.value.page);
  const selectedId = computed(() => state.value.selectedId);
  const hoverId = computed(() => state.value.hoverId);
  const selectedNode = computed(() => state.value.selectedNode);
  const selectedLocation = computed(() => state.value.selectedLocation);
  const breadcrumb = computed(() => state.value.breadcrumb);
  const nodeCount = computed(() => state.value.nodeCount);
  const dirty = computed(() => state.value.dirty);
  const canUndo = computed(() => state.value.canUndo);
  const canRedo = computed(() => state.value.canRedo);
  const loading = computed(() => state.value.loading);
  const lastSavedAt = computed(() => state.value.lastSavedAt);
  const dropHint = computed(() => state.value.dropHint);
  const dragPayload = computed(() => state.value.dragPayload);
  const clipboard = computed(() => state.value.clipboard);

  /** 供扩展/测试读取当前物料目录，与 React 侧 store.registry 等价 */
  const catalog = computed(() => kernel.registry);

  /* ---------------- 操作 ---------------- */

  const undo = () => kernel.undo();
  const redo = () => kernel.redo();
  const setRepository = (next: PageRepository | null) => kernel.setRepository(next);
  const setMaterialCatalog = (next: MaterialRegistry) => kernel.setMaterialCatalog(next);
  const load = (id: string) => kernel.load(id);
  const save = () => kernel.save();
  const setPage = (next: PageSchema) => kernel.setPage(next);
  const setTitle = (title: string) => kernel.setTitle(title);
  const setDevice = (device: DeviceType) => kernel.setDevice(device);
  const patchPage = (patch: Partial<PageSchema>) => kernel.patchPage(patch);
  const createNode = (component: string) => kernel.createNode(component);
  const select = (id: string | null) => kernel.select(id);
  const hover = (id: string | null) => kernel.hover(id);
  const addNode = (component: string, targetId: string | null = null, position: DropPosition = "after") =>
    kernel.addNode(component, targetId, position);
  const addNodeSmart = (component: string) => kernel.addNodeSmart(component);
  const relocate = (id: string, targetId: string | null, position: DropPosition) =>
    kernel.relocate(id, targetId, position);
  const removeSelected = () => kernel.removeSelected();
  const duplicateSelected = () => kernel.duplicateSelected();
  const moveSelected = (delta: number) => kernel.moveSelected(delta);
  const copySelected = () => kernel.copySelected();
  const pasteNode = () => kernel.pasteNode();
  const updateProp = (key: string, value: unknown) => kernel.updateProp(key, value);
  const updateNodeProp = (nodeId: string, key: string, value: unknown) =>
    kernel.updateNodeProp(nodeId, key, value);
  const setNodeDataSource = (source: ExternalDataSource | undefined) => kernel.setNodeDataSource(source);
  const updateStyle = (key: string, value: unknown) => kernel.updateStyle(key, value);
  const updateSpacing = (key: SpacingKey, box: SpacingBox) => kernel.updateSpacing(key, box);
  const setRules = (rules: ValidationRule[]) => kernel.setRules(rules);
  const setEventActions = (name: string, actions: ActionSchema[]) => kernel.setEventActions(name, actions);
  const setDirective = (name: "show" | "if" | "for", value: string) => kernel.setDirective(name, value);
  const addDataSourceEntry = (key: string, json: string) => kernel.addDataSourceEntry(key, json);
  const beginDrag = (payload: { kind: "new"; component: string } | { kind: "move"; id: string }) =>
    kernel.beginDrag(payload);
  const setDropHint = (hint: { id: string | null; position: DropPosition } | null) =>
    kernel.setDropHint(hint);
  const clearDrag = () => kernel.clearDrag();
  const applyDrop = (hint: { id: string | null; position: DropPosition } | null) => kernel.applyDrop(hint);
  const exportJSON = () => kernel.exportJSON();
  const replaceWith = (next: PageSchema) => kernel.replaceWith(next);
  const clear = () => kernel.clear();

  return {
    page,
    selectedId,
    hoverId,
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
    catalog,
    undo,
    redo,
    setRepository,
    setMaterialCatalog,
    load,
    save,
    setPage,
    setTitle,
    setDevice,
    patchPage,
    createNode,
    select,
    hover,
    addNode,
    addNodeSmart,
    relocate,
    removeSelected,
    duplicateSelected,
    moveSelected,
    copySelected,
    pasteNode,
    updateProp,
    updateNodeProp,
    setNodeDataSource,
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
