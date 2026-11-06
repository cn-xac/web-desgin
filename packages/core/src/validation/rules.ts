/**
 * 数据校验规则模型（框架无关）。
 *
 * 设计约束：
 * 1. 规则是纯数据，随 Schema 一起存，JSON 里永远不出现可执行代码；
 * 2. 正则只存「源码 + 修饰符」，运行时编译，设计器可以实时试编译；
 * 3. 规则挂在节点上（`node.rules`），而不是塞进组件 props ——
 *    校验描述的是数据契约，不是某个 UI 控件的显示参数。
 */

import type { NodeSchema } from "../schema/types";
import { bareKey } from "../materials/keys";

export type RuleType =
  | "required"
  | "minLength"
  | "maxLength"
  | "min"
  | "max"
  | "pattern"
  | "email"
  | "phone"
  | "integer";

export interface ValidationRule {
  type: RuleType;
  /** min/max 为数字；minLength/maxLength 为整数；pattern 为正则源码 */
  value?: number | string;
  /** 仅 pattern 使用，取值限定在 imsu */
  flags?: string;
  /** 自定义错误文案，支持 {label} / {value} 占位 */
  message?: string;
  /** 条件表达式（裸表达式或 {{}}），为假时跳过该规则 */
  when?: string;
}

export type RuleValueKind = "none" | "length" | "number" | "regex";

export interface RuleDefinition {
  type: RuleType;
  label: string;
  valueKind: RuleValueKind;
  valueLabel?: string;
  hint?: string;
}

/** 设计器与文档共用一份定义，避免文案漂移 */
export const RULE_DEFINITIONS: RuleDefinition[] = [
  { type: "required", label: "必填", valueKind: "none", hint: "值为空时报错（空串 / null / 空数组都算空）" },
  { type: "minLength", label: "最短长度", valueKind: "length", valueLabel: "字符数", hint: "按字符计，emoji 算 1 个" },
  { type: "maxLength", label: "最长长度", valueKind: "length", valueLabel: "字符数", hint: "按字符计，emoji 算 1 个" },
  { type: "min", label: "最小值", valueKind: "number", valueLabel: "数值", hint: "仅对可转为数字的值生效" },
  { type: "max", label: "最大值", valueKind: "number", valueLabel: "数值", hint: "仅对可转为数字的值生效" },
  { type: "pattern", label: "自定义正则", valueKind: "regex", valueLabel: "正则表达式", hint: "只写源码，不带首尾斜杠；如 ^[A-Z]{2}\\d{4}$" },
  { type: "email", label: "邮箱", valueKind: "none" },
  { type: "phone", label: "手机号", valueKind: "none", hint: "中国大陆 11 位手机号" },
  { type: "integer", label: "整数", valueKind: "none" },
];

const RULE_MAP = new Map<string, RuleDefinition>(RULE_DEFINITIONS.map((item) => [item.type, item]));

export const RULE_TYPES = new Set<string>(RULE_DEFINITIONS.map((item) => item.type));

export function getRuleDefinition(type: string): RuleDefinition | undefined {
  return RULE_MAP.get(type);
}

/** 内置格式校验 */
export const BUILTIN_PATTERNS: Partial<Record<RuleType, RegExp>> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^1[3-9]\d{9}$/,
};

const ALLOWED_FLAGS = /^[imsu]*$/;

/** 编译正则；源码非法返回 null（由 Schema 校验负责提示，运行时不误报） */
export function compilePattern(source: string, flags = ""): RegExp | null {
  if (typeof source !== "string" || !source.trim()) return null;
  try {
    return new RegExp(source, ALLOWED_FLAGS.test(flags) ? flags : "");
  } catch {
    return null;
  }
}

/** 单条规则归一化：类型不认识、值不合法时返回 null */
export function normalizeRule(raw: unknown): ValidationRule | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (!RULE_TYPES.has(type)) return null;

  const definition = RULE_MAP.get(type)!;
  const rule: ValidationRule = { type: type as RuleType };

  if (definition.valueKind === "number" || definition.valueKind === "length") {
    const num = typeof record.value === "number" ? record.value : Number(record.value);
    if (Number.isFinite(num)) rule.value = definition.valueKind === "length" ? Math.trunc(num) : num;
  } else if (definition.valueKind === "regex") {
    if (typeof record.value === "string") rule.value = record.value;
    if (typeof record.flags === "string" && record.flags.trim()) rule.flags = record.flags.trim();
  }

  if (typeof record.message === "string" && record.message.trim()) rule.message = record.message.trim();
  if (typeof record.when === "string" && record.when.trim()) rule.when = record.when.trim();

  return rule;
}

export function normalizeRules(input: unknown): ValidationRule[] {
  if (!Array.isArray(input)) return [];
  const out: ValidationRule[] = [];
  for (const item of input) {
    const rule = normalizeRule(item);
    if (rule) out.push(rule);
  }
  return out;
}

/** 空值判定：null / undefined / 纯空白字符串 / 空数组 */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** 这类组件语义上是「选择」，必填文案用「请选择」 */
const CHOOSE_COMPONENTS = new Set([
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "rate",
  "slider",
  "org-picker",
  "dict-select",
  "cascader",
]);

export function defaultRuleMessage(rule: ValidationRule, label: string, component?: string): string {
  const name = label || "该项";
  switch (rule.type) {
    case "required":
      return `${CHOOSE_COMPONENTS.has(bareKey(component ?? "")) ? "请选择" : "请填写"}${name}`;
    case "minLength":
      return `${name}不能少于 ${rule.value ?? 0} 个字符`;
    case "maxLength":
      return `${name}不能超过 ${rule.value ?? 0} 个字符`;
    case "min":
      return `${name}不能小于 ${rule.value ?? 0}`;
    case "max":
      return `${name}不能大于 ${rule.value ?? 0}`;
    case "pattern":
      return `${name}格式不正确`;
    case "email":
      return `${name}不是合法的邮箱地址`;
    case "phone":
      return `${name}不是合法的手机号`;
    case "integer":
      return `${name}必须是整数`;
    default:
      return `${name}不符合校验规则`;
  }
}

/** 自定义文案里的 {label} / {value} 占位替换 */
export function formatMessage(template: string, label: string, rule: ValidationRule): string {
  return template
    .replace(/\{label\}/g, label || "该项")
    .replace(/\{value\}/g, rule.value === undefined ? "" : String(rule.value));
}

export function ruleMessage(rule: ValidationRule, label: string, component?: string): string {
  return rule.message ? formatMessage(rule.message, label, rule) : defaultRuleMessage(rule, label, component);
}

/**
 * 节点最终生效的规则。
 * `props.required` 是 1.x 的写法，这里做兼容：等价于一条 required 规则。
 */
export function effectiveRules(
  node: Pick<NodeSchema, "rules">,
  props: Record<string, unknown> = {},
): ValidationRule[] {
  const rules = normalizeRules(node.rules);
  if (props.required === true && !rules.some((rule) => rule.type === "required")) {
    return [{ type: "required" }, ...rules];
  }
  return rules;
}

export function isRequired(node: Pick<NodeSchema, "rules">, props: Record<string, unknown> = {}): boolean {
  return effectiveRules(node, props).some((rule) => rule.type === "required");
}

/** 设计器里按组件类型过滤可用规则：数字类不给长度规则，文本类不给数值规则 */
export function ruleTypesFor(component: string): RuleType[] {
  const bare = bareKey(component);
  const numeric = ["number", "amount-input", "slider", "rate"].includes(bare);
  const text = ["input", "textarea"].includes(bare);

  return RULE_DEFINITIONS.filter((definition) => {
    if (definition.type === "required") return true;
    if (definition.type === "min" || definition.type === "max") return numeric;
    if (definition.type === "integer") return numeric;
    if (definition.type === "minLength" || definition.type === "maxLength") return text;
    if (definition.type === "pattern" || definition.type === "email" || definition.type === "phone") return text;
    return true;
  }).map((definition) => definition.type);
}
