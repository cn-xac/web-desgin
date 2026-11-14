/**
 * 元素显示 / 隐藏配置契约（@todo r5u4Ul「元素的显示和隐藏逻辑优化」）。
 *
 * 设计要点：
 * - 配置挂在**目标节点自身**（`NodeSchema.visibility`），只控制该节点；
 * - 条件行复用通用「多条件组件」(rfD7Jv) 的数据模型，后续外部数据源触发条件、
 *   数据计算 (rtHicl) 的条件参与可直接复用 `ConditionGroup`；
 * - 全部是纯数据，JSON 里不出现可执行代码。
 *
 * 与旧 `directives` 的关系：两者并存，旧 Schema 不迁移、行为不变；
 * 新配置优先级更高，未配置时回落到 directives。
 */

/** 引用子表单明细字段时的聚合口径；缺省为求和 */
export type ConditionAggregate = "sum" | "avg" | "min" | "max";

/** 条件行关系运算符 */
export type ConditionOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "empty"
  | "notEmpty"
  | "truthy"
  | "falsy";

/** 条件间组合方式；advanced 用序号表达式，如 `1 and (2 or 3)` */
export type ConditionMode = "and" | "or" | "advanced";

export interface ConditionRow {
  /**
   * 左侧元素的绑定路径，例如 `form.type`、`form.orders[0].qty`。
   * 子表单内字段在设计期用 `[0]` 占位（与 `data/bindable.ts` 的 GROUP_INDEX 一致）。
   * 省略时表示「仅值形态」：无左侧、无关系，直接把 value 当布尔表达式求值。
   */
  left?: string;
  /**
   * 左侧取值口径。仅在 left 指向子表单明细字段时有意义：
   * 配置后按**全部行**聚合，否则按当前行取值。缺省 `sum`。
   */
  aggregate?: ConditionAggregate;
  /** 关系运算符；仅值形态时省略 */
  operator?: ConditionOperator;
  /** 右侧值，支持字面量与 `{{path}}` / 裸表达式 */
  value?: unknown;
}

export interface ConditionGroup {
  mode: ConditionMode;
  rows: ConditionRow[];
  /** mode === "advanced" 时的组合表达式，序号从 1 开始 */
  expression?: string;
}

/** 节点自身的显隐控制配置 */
export interface VisibilityConfig {
  /** 命中则显示（优先级高于 hide） */
  show?: ConditionGroup;
  /** 仅在 show 未命中时生效，命中则隐藏 */
  hide?: ConditionGroup;
}

/** 宿主按节点 id 传入的显隐控制 */
export interface ExternalVisibilityEntry {
  visible: boolean;
  /** true = 忽略节点自身条件，强制使用外部结果 */
  force?: boolean;
}

export type ExternalVisibility = Record<string, ExternalVisibilityEntry>;

export type VisibilitySource =
  | "external-force"
  | "local-show"
  | "local-hide"
  | "external"
  | "directive"
  | "default";

export interface VisibilityDecision {
  visible: boolean;
  source: VisibilitySource;
  /** 隐藏方式：display:none（show）或不渲染（if）；visible 为 true 时省略 */
  mode?: "show" | "if";
}

/** 条件求值上下文，由渲染器在子表单内构造 */
export interface VisibilityContext {
  /** 当前明细行下标，用于把 `[0]` 占位替换成真实行；undefined 表示页面级 */
  rowIndex?: number;
}

export const CONDITION_AGGREGATES: ReadonlyArray<{ value: ConditionAggregate; label: string }> = [
  { value: "sum", label: "求和" },
  { value: "avg", label: "平均值" },
  { value: "min", label: "最小值" },
  { value: "max", label: "最大值" },
];

export const CONDITION_OPERATOR_OPTIONS: ReadonlyArray<{
  value: ConditionOperator;
  label: string;
  /** 是否不需要右侧值 */
  unary?: boolean;
  /** 适用值类型：number / string / any */
  kind: "number" | "string" | "any";
}> = [
  { value: "eq", label: "等于", kind: "any" },
  { value: "ne", label: "不等于", kind: "any" },
  { value: "gt", label: "大于", kind: "number" },
  { value: "gte", label: "大于等于", kind: "number" },
  { value: "lt", label: "小于", kind: "number" },
  { value: "lte", label: "小于等于", kind: "number" },
  { value: "contains", label: "包含", kind: "string" },
  { value: "notContains", label: "不包含", kind: "string" },
  { value: "startsWith", label: "开头是", kind: "string" },
  { value: "endsWith", label: "结尾是", kind: "string" },
  { value: "empty", label: "为空", kind: "any", unary: true },
  { value: "notEmpty", label: "不为空", kind: "any", unary: true },
  { value: "truthy", label: "为真", kind: "any", unary: true },
  { value: "falsy", label: "为假", kind: "any", unary: true },
];

export const CONDITION_MODE_OPTIONS: ReadonlyArray<{ value: ConditionMode; label: string }> = [
  { value: "and", label: "并且" },
  { value: "or", label: "或者" },
  { value: "advanced", label: "高级" },
];
