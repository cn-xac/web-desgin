import { createContext, useContext } from "react";
import type {
  ActionAdapter,
  ActionSchema,
  DropPosition,
  MaterialRegistry,
  NodeSchema,
  PageSchema,
  UiAdapter,
  UiEventHook,
  UiEventPayload,
} from "@x-ac/design-core";
import type { ReactMaterial } from "./adapter";

export type RenderMode = "view" | "edit";

/** 设计器与渲染器之间的画布场景契约（对齐 Vue 的 DESIGNER_SCENE） */
export interface RendererDesignerScene {
  selectedId: () => string | null;
  hoveredId: () => string | null;
  hintFor: (id: string) => DropPosition | null;
  select: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  onNodeDragStart: (id: string) => void;
  onNodeDragOver: (hint: { id: string; position: DropPosition }) => void;
  onNodeDragLeave: (id: string) => void;
  onNodeDrop: (hint: { id: string; position: DropPosition }) => void;
}

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
  /** 节点事件只读通知：拿到的是同一个 UiEventPayload，不参与控制流（对齐 Vue 的 @node-event） */
  notifyEvent: (payload: UiEventPayload) => void;
  /** 设计态开关：true 时画布节点带选中/悬停/拖拽能力，view 模式恒为 false */
  design: boolean;
  /** 设计器注入的画布场景；未提供时渲染器行为与纯运行时完全一致 */
  designer?: RendererDesignerScene;
  /** submitForm 动作成功时回调，供宿主发请求 */
  onFormSubmit?: (payload: Record<string, unknown>, action: ActionSchema) => void;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

/**
 * 绑定前缀：表单控件未显式设置 modelValue 时，按「前缀.组件ID」自动推导绑定路径。
 * 顶层默认 "form"；子表单会按当前组路径注入更具体的前缀（如 form.items[0]），
 * 从而让组内字段自动落到 form.items[i].<id>，天然支持子表单无限嵌套。
 */
export const BINDING_BASE = createContext<string>("form");

export function useRenderContext(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error("[vue-design/react] SchemaNode 必须放在 SchemaRenderer 内部使用");
  return ctx;
}
