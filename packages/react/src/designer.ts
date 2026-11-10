/**
 * 设计器入口（按需引入，渲染器产物不含这部分代码）。
 *
 *   import { SchemaDesigner } from "@x-ac/web-design-react/designer";
 *   <SchemaDesigner pageId="p1" onSaved={...} ref={ref} />
 *
 * 状态机与页面仓储来自 @x-ac/web-design-core，与 Vue 的 /designer 子入口同源；
 * 设计器自身 UI 走 UiAdapter.designer / editors 槽位，未配置时回落原生控件。
 */
import "./designer/designer.css";

export { SchemaDesigner } from "./designer/SchemaDesigner";
export type { SchemaDesignerHandle, SchemaDesignerProps } from "./designer/SchemaDesigner";
export { DesignerContext, useDesigner } from "./designer/context";
export type { DesignerContextValue, DesignerNotifyType } from "./designer/context";
export { UiControl, resolveDesignerUi, resolveNotify } from "./designer/ui";
export type { DesignerControlProps, SelectOption } from "./designer/ui";

/** 内核透出：宿主不必为了建仓储或订阅状态单独装 core */
export { DesignerStore, createMemoryRepository, getPageRepository, setPageRepository } from "@x-ac/web-design-core";
export type {
  DesignerState,
  DesignerStoreOptions,
  DragPayload,
  DropHint,
  PageRecord,
  PageRepository,
} from "@x-ac/web-design-core";
