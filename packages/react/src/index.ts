/**
 * @x-ac/design-react —— 用同一份 PageSchema 在 React 里渲染页面。
 *
 * 与 Vue 适配层共享 core：表达式、树、校验、样式合并、动作白名单完全一致，
 * 差异只在「组件映射」与「状态驱动方式」。
 */
import "./styles.css";

export { SchemaRenderer } from "./SchemaRenderer";
export type { SchemaRendererHandle, SchemaRendererProps } from "./SchemaRenderer";
export { SchemaNode, isActionRegistered } from "./SchemaNode";
export { COMPONENTS, resolveComponent } from "./components";
export type { ControlProps } from "./components";
export { RenderContext, useRenderContext } from "./context";
export type { RenderContextValue, RenderMode } from "./context";
export { createReactAdapter, defaultAdapter } from "./actions";
export type { ReactAdapterOptions } from "./actions";
export { usePageStore } from "./scope";
export type { PageStore } from "./scope";

// 校验 / 数据导出与 Vue 层共用 core 实现，这里透出一份，宿主不必再装 core
export {
  RULE_DEFINITIONS,
  collectFields,
  describeField,
  errorsToText,
  exportData,
  toDataJSON,
  validateData,
} from "@x-ac/design-core";
export type { DataExportOptions, DataExportResult, FieldError, ValidationRule } from "@x-ac/design-core";
