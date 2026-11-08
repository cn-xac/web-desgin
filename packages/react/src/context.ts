import { createContext, useContext } from "react";
import type {
  ActionAdapter,
  ActionSchema,
  MaterialRegistry,
  NodeSchema,
  PageSchema,
  UiAdapter,
  UiEventHook,
} from "@x-ac/design-core";
import type { ReactMaterial } from "./adapter";

export type RenderMode = "view" | "edit";

export interface RenderContextValue {
  page: PageSchema;
  scope: Record<string, unknown>;
  errors: Record<string, string>;
  mode: RenderMode;
  /** 动作副作用适配（提示 / 确认框） */
  adapter: ActionAdapter;
  /** UI 适配包：组件实现、物料元数据、双向绑定通道都从这里取 */
  ui: UiAdapter<ReactMaterial>;
  /** 由 ui.materials 建的只读目录：物料元数据与默认属性的查询入口 */
  catalog: MaterialRegistry;
  navigate: (to: string) => void;
  resetScope: (paths?: string[]) => void;
  flush: () => void;
  /** 写入 scope 并触发重渲染；传 nodeId 会顺手清掉该字段的错误 */
  setValue: (path: string, value: unknown, nodeId?: string) => void;
  /** 只校验一个节点，结果同步进 errors（失焦时调用） */
  validateField: (node: NodeSchema) => void;
  /** 宿主的事件拦截钩子（与 Vue 的 :on-event 同签名） */
  onEvent?: UiEventHook;
  /** submitForm 动作成功时回调，供宿主发请求 */
  onFormSubmit?: (payload: Record<string, unknown>, action: ActionSchema) => void;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

export function useRenderContext(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error("[vue-design/react] SchemaNode 必须放在 SchemaRenderer 内部使用");
  return ctx;
}
