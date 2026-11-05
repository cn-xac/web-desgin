export { default as SchemaRenderer } from "./SchemaRenderer.vue";
export { default as SchemaNode } from "./SchemaNode.vue";
export { elementAdapter, runActions } from "./actions";
export type { VueActionContext } from "./actions";
export { usePageScope } from "./usePageScope";
export type { PageScopeApi } from "./usePageScope";
export { DESIGNER_SCENE, RENDER_CONTEXT } from "./context";
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
} from "@x-ac/design-core";
export type {
  ActionAdapter,
  ActionContext,
  ActionSchema,
  DataExportOptions,
  DataExportResult,
  FieldError,
  FormField,
  RuleType,
  ValidationRule,
} from "@x-ac/design-core";
