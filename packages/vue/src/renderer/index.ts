export { default as SchemaRenderer } from "./SchemaRenderer.vue";
/** 渲染标签的语义化别名：<SchemaPage :page="schema" v-model:data="formData" @submit="..." /> */
export { default as SchemaPage } from "./SchemaRenderer.vue";
export { default as SchemaNode } from "./SchemaNode.vue";
export { runNodeActions } from "./runActions";
export type { NodeActionContext } from "./runActions";
export { usePageScope } from "./usePageScope";
export type { PageScopeApi } from "./usePageScope";
export { DESIGNER_SCENE, RENDER_CONTEXT, UI_ADAPTER, materialFrom, useUiAdapter } from "./context";
export type { DesignerScene, RenderContext } from "./context";

// 动作协议与校验在 core，渲染器出口透传一份，宿主只装一个包也能用
export {
  ACTION_DEFINITIONS,
  ACTION_OPTIONS,
  ACTION_REGISTRY,
  RULE_DEFINITIONS,
  collectFields,
  describeField,
  errorsToText,
  exportData,
  normalizeRules,
  toDataJSON,
  validateData,
  validateRequired,
} from "@x-ac/web-design-core";
export { camelizeEventName, createEventPayload } from "@x-ac/web-design-core";
export type {
  ActionAdapter,
  ActionContext,
  ActionSchema,
  UiEventHook,
  UiEventPayload,
  DataExportOptions,
  DataExportResult,
  FieldError,
  FormField,
  RuleType,
  ValidationRule,
} from "@x-ac/web-design-core";
