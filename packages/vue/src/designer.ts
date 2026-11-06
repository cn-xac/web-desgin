/**
 * 设计器入口（按需引入，渲染器产物不含这部分代码）。
 *
 * 标签即用：
 *   <SchemaDesigner page-id="p1" @saved="onSaved" @export-schema="onExport" />
 *   import { SchemaDesigner } from "@x-ac/design-vue/designer";
 *
 * 或异步拆包：
 *   const SchemaDesigner = defineAsyncComponent(() => import("@x-ac/design-vue/designer").then(m => m.SchemaDesigner));
 */
export { default as DesignerView } from "./designer/DesignerView.vue";
/** 设计器标签的语义化别名，与 DesignerView 等同 */
export { default as SchemaDesigner } from "./designer/DesignerView.vue";
export { useDesignerStore } from "./designer/store";
export type { DropHint, DragPayload } from "./designer/store";
export { createMemoryRepository, getPageRepository, setPageRepository } from "./persistence/repo";
export type { PageRecord, PageRepository } from "./persistence/repo";
