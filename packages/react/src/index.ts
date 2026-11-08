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
export { REACT_BINDING, createNativeAdapter, nativeAdapter } from "./adapter";
export type { ReactMaterial } from "./adapter";
// 应用级适配包注入：与 Vue 的 createVueDesign({ adapter }) 同语义
export { UI_ADAPTER_CONTEXT, ReactDesignProvider, createReactDesign, useUiAdapter } from "./provider";
export type { ReactDesignProviderProps } from "./provider";
export { usePageStore } from "./scope";
export type { PageStore } from "./scope";

// 事件协议从 core 透出：宿主只装一个适配层包也能写强类型钩子
export { createEventPayload, toReactHandlerName } from "@x-ac/design-core";
export type { UiEventHook, UiEventPayload } from "@x-ac/design-core";

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

// 适配包组合：宿主注册业务物料只需要这几样，不必直接依赖 core
export {
  MATERIALS,
  createRegistry,
  defineMaterial,
  materialKey,
  missingComponents,
  registerMaterials,
  withMaterials,
} from "@x-ac/design-core";
export type {
  CustomMaterial,
  CustomMaterialInput,
  Material,
  MaterialRegistry,
  PropField,
  PropFieldType,
  UiAdapter,
} from "@x-ac/design-core";
