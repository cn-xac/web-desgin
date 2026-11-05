/**
 * 物料协议。新增组件 = 写一个 Vue 组件 + 在此登记一份 meta，不改设计器内核。
 */

export type MaterialCategory = "布局" | "展示" | "表单" | "交互" | "业务";

export type MaterialKind = "layout" | "display" | "field" | "action";

export type PropFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "color"
  | "options"
  | "columns";

export interface PropField {
  key: string;
  label: string;
  type: PropFieldType;
  /** select 的候选值 */
  options?: Array<string | number>;
  tip?: string;
}

export interface MaterialEvent {
  /** 事件名，与 Vue 组件 emit 名一致 */
  name: string;
  title: string;
}

export interface Material {
  /** Schema 中的 component 值 */
  component: string;
  title: string;
  category: MaterialCategory;
  kind: MaterialKind;
  /** 物料面板图标（单字符，避免引入图标包体积） */
  icon: string;
  defaultProps: Record<string, unknown>;
  /**
   * 物料自带的默认样式（含 margin / padding 这类通用间距）。
   * 与 defaultProps 一样属于「默认值不落库」：节点没写该键时才生效，
   * 用户一旦在面板里设了值，就以节点的 style 为准。
   */
  defaultStyle?: Record<string, string>;
  fields: PropField[];
  events?: MaterialEvent[];
  /** 能否接收子节点 */
  acceptsChildren?: boolean;
  /** 组件正文来自哪个属性（用于 tag / button 这类无 children 的组件） */
  textProp?: string;
  /** 由渲染器消费、不应透传到 DOM 的属性（如 text 的 size / muted） */
  internalProps?: string[];
  /** 提示：该组件适合用在什么场景 */
  hint?: string;
  /** 是否为表单控件（参与必填校验） */
  isFormControl?: boolean;
}
