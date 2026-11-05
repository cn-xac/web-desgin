/**
 * 设计器入口（按需引入，渲染器产物不含这部分代码）。
 *
 *   const Designer = defineAsyncComponent(() => import("@x-ac/design-vue/designer").then(m => m.DesignerView));
 */
export { default as DesignerView } from "./designer/DesignerView.vue";
export { useDesignerStore } from "./designer/store";
export type { DropHint, DragPayload } from "./designer/store";
export { createMemoryRepository, getPageRepository, setPageRepository } from "./persistence/repo";
export type { PageRecord, PageRepository } from "./persistence/repo";
