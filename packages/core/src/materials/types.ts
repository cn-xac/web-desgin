/**
 * 物料协议。新增组件 = 写一个 Vue 组件 + 在此登记一份 meta，不改设计器内核。
 */

export type MaterialCategory = "布局" | "展示" | "表单" | "交互" | "导航" | "业务";

export type MaterialKind = "layout" | "display" | "field" | "action" | "subform";

export type PropFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "color"
  | "options"
  | "columns";

/**
 * 属性分组。属性面板按组折叠：UI 库组件的属性动辄二十几个，
 * 全平铺会让面板变成一个需要不停滚动的长列表。
 */
export type PropFieldGroup = "basic" | "content" | "data" | "style" | "advanced";

/** 属性可移植性：行为/内容缺失是缺陷，视觉缺失是可接受的外观差异（详见 portability.ts） */
export type Portability = "behavior" | "content" | "visual";

/** select 的候选项；`value` 是写进 Schema 的值，`label` 是面板上显示的文字 */
export interface PropOption {
  label: string;
  value: string | number;
}

export interface PropField {
  key: string;
  label: string;
  type: PropFieldType;
  /** select 的候选值：裸值直接用，需要中文展示时用 { label, value } */
  options?: Array<string | number | PropOption>;
  /**
   * 所属分组，缺省 basic。
   * `advanced` 组默认折叠，用来收纳「能设但少用」的属性。
   */
  group?: PropFieldGroup;
  /** number 类型的上下限与步长（仅约束面板输入，不改变运行时行为） */
  min?: number;
  max?: number;
  step?: number;
  tip?: string;
  /**
   * 跨库映射等级。缺省按键名推断（见 fieldPortability），
   * 正式物料建议显式标注，避免新增字段默默归入 visual。
   */
  portability?: Portability;
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
  /**
   * 设计态是否穿透包裹层（display: contents）。
   * 用于「栅格列」这类必须成为父级 flex/grid 直系子项的节点：
   * 设计态默认包裹层是 display:block，会打断 el-row > el-col 的 flex 关系，
   * 导致列宽由内容撑开而非由 span 决定。标 true 后包裹层改为 display:contents，
   * 选中框/悬停框改画到组件根节点，由引擎统一处理。
   */
  wrapperPassthrough?: boolean;
  /** 组件正文来自哪个属性（用于 tag / button 这类无 children 的组件） */
  textProp?: string;
  /** 由渲染器消费、不应透传到 DOM 的属性（如 text 的 size / muted） */
  internalProps?: string[];
  /** 提示：该组件适合用在什么场景 */
  hint?: string;
  /** 是否为表单控件（参与必填校验） */
  isFormControl?: boolean;
  /**
   * 物料归属：adapter = 适配包提供（官方物料），user = 业务方注册。
   * 自定义物料的跨库可移植性由注册者自行负责，引擎不做保证。
   */
  owner?: "adapter" | "user";
  /**
   * 是否能被其它 UI 库渲染。false 表示该物料只在当前适配包下有效：
   * 不参加跨库一致性测试，静态 HTML 导出走占位。
   */
  portable?: boolean;
}
