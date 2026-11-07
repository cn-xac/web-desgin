/**
 * 数据校验引擎（框架无关）。
 *
 * 与 `schema/validator.ts` 的区别：
 * - validator.ts 校验 **Schema 结构**（能不能渲染）；
 * - 这里校验 **用户填的数据**（能不能提交）。
 */

import type { NodeSchema, PageSchema } from "../schema/types";
import type { Scope } from "../schema/expression";
import { extractPath, getByPath, resolveBoolean, resolveValue } from "../schema/expression";
import { registry as globalRegistry } from "../materials/catalog";
import type { MaterialRegistry } from "../materials/registry";
import { walk } from "../schema/tree";
import {
  BUILTIN_PATTERNS,
  compilePattern,
  effectiveRules,
  isEmptyValue,
  ruleMessage,
  type RuleType,
  type ValidationRule,
} from "./rules";

/** 一个可校验的字段：由表单控件 + 它的 modelValue 绑定推导出来 */
export interface FormField {
  nodeId: string;
  /** 绑定路径，如 form.name；没绑定的为 null */
  path: string | null;
  label: string;
  component: string;
  value: unknown;
  rules: ValidationRule[];
  required: boolean;
}

export interface FieldError {
  nodeId: string;
  path: string | null;
  label: string;
  component: string;
  /** 触发报错的规则类型 */
  rule: RuleType;
  message: string;
}

export interface DataValidationResult {
  valid: boolean;
  errors: FieldError[];
  /** nodeId -> 错误文案，可直接喂给渲染器 */
  byNode: Record<string, string>;
  checkedFields: number;
  checkedRules: number;
}

/** 字符长度：数组算元素个数，字符串按码点算（emoji 记 1） */
export function valueLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return [...value].length;
  if (value === undefined || value === null) return 0;
  return String(value).length;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * 把一个节点描述成字段；非表单控件返回 null。
 *
 * `materials` 由渲染层注入（适配包 + 业务物料），不传则回落全局 registry：
 * 业务物料 `isFormControl: true` 时，只有注入目录才认得出来。
 */
export function describeField(
  node: NodeSchema,
  scope: Scope,
  materials: MaterialRegistry = globalRegistry,
): FormField | null {
  const material = materials.get(node.component);
  if (!material?.isFormControl) return null;

  const props = materials.defaults(node.component, node.props);
  const path = extractPath(props.modelValue);
  const value = path ? getByPath(scope, path) : resolveValue(props.modelValue, scope);
  const rules = effectiveRules(node, props);

  return {
    nodeId: node.id,
    path,
    label: String(props.label ?? material.title ?? node.component),
    component: node.component,
    value,
    rules,
    required: rules.some((rule) => rule.type === "required"),
  };
}

/** 收集页面里所有表单字段（按渲染顺序） */
export function collectFields(
  page: PageSchema,
  scope: Scope,
  materials: MaterialRegistry = globalRegistry,
): FormField[] {
  const fields: FormField[] = [];
  walk(page.children, (node) => {
    const field = describeField(node, scope, materials);
    if (field) fields.push(field);
  });
  return fields;
}

function fail(
  field: FormField,
  rule: ValidationRule,
): FieldError {
  return {
    nodeId: field.nodeId,
    path: field.path,
    label: field.label,
    component: field.component,
    rule: rule.type,
    message: ruleMessage(rule, field.label, field.component),
  };
}

/** 校验单条规则，通过返回 null */
export function checkRule(rule: ValidationRule, field: FormField, scope: Scope): FieldError | null {
  // 条件规则：when 为假时整条跳过
  if (rule.when && !resolveBoolean(rule.when, scope)) return null;

  const value = field.value;

  if (rule.type === "required") {
    return isEmptyValue(value) ? fail(field, rule) : null;
  }

  // 非必填时，空值不参与格式校验（否则「没填」会同时报两个错）
  if (isEmptyValue(value)) return null;

  switch (rule.type) {
    case "minLength":
      return valueLength(value) < Number(rule.value ?? 0) ? fail(field, rule) : null;

    case "maxLength":
      return valueLength(value) > Number(rule.value ?? 0) ? fail(field, rule) : null;

    case "min": {
      if (rule.value === undefined) return null;
      const num = toNumber(value);
      return num !== null && num < Number(rule.value) ? fail(field, rule) : null;
    }

    case "max": {
      if (rule.value === undefined) return null;
      const num = toNumber(value);
      return num !== null && num > Number(rule.value) ? fail(field, rule) : null;
    }

    case "pattern": {
      const regex = compilePattern(String(rule.value ?? ""), rule.flags ?? "");
      // 正则非法属于 Schema 问题，由结构校验拦截，这里不误报用户输入错误
      if (!regex) return null;
      return regex.test(String(value)) ? null : fail(field, rule);
    }

    case "email":
    case "phone": {
      const regex = BUILTIN_PATTERNS[rule.type]!;
      return regex.test(String(value).trim()) ? null : fail(field, rule);
    }

    case "integer": {
      const num = toNumber(value);
      return num !== null && Number.isInteger(num) ? null : fail(field, rule);
    }

    default:
      return null;
  }
}

/** 校验单个字段：返回第一条不通过的规则 */
export function validateFieldValue(field: FormField, scope: Scope): FieldError | null {
  // 字段对象可能是早先的快照：有绑定路径时以当前 scope 为准，避免校验旧值
  const current: FormField = field.path ? { ...field, value: getByPath(scope, field.path) } : field;

  for (const rule of current.rules) {
    const issue = checkRule(rule, current, scope);
    if (issue) return issue;
  }
  return null;
}

export interface ValidateDataOptions {
  /** 传入渲染器持有的 errors 时会就地清理 / 写入，避免再拷一层 */
  errors?: Record<string, string>;
  /** 复用已采集的字段，避免重复 walk */
  fields?: FormField[];
  /** 渲染层持有的物料目录；不传则用全局 registry */
  materials?: MaterialRegistry;
}

/** 校验整页数据 */
export function validateData(
  page: PageSchema,
  scope: Scope,
  options: ValidateDataOptions = {},
): DataValidationResult {
  const fields = options.fields ?? collectFields(page, scope, options.materials ?? globalRegistry);
  const errors: FieldError[] = [];
  const byNode: Record<string, string> = {};
  let checkedRules = 0;

  for (const field of fields) {
    checkedRules += field.rules.length;
    const issue = validateFieldValue(field, scope);
    if (!issue) continue;
    errors.push(issue);
    byNode[issue.nodeId] = issue.message;
  }

  if (options.errors) {
    // 清掉上一轮遗留、这一轮已经修好的错误
    for (const key of Object.keys(options.errors)) {
      if (!(key in byNode)) delete options.errors[key];
    }
    for (const [nodeId, message] of Object.entries(byNode)) {
      options.errors[nodeId] = message;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    byNode,
    checkedFields: fields.length,
    checkedRules,
  };
}

/** 失焦时只校验当前字段，并同步 errors（不触发整页扫描） */
export function validateNodeField(
  node: NodeSchema,
  scope: Scope,
  errors?: Record<string, string>,
  materials: MaterialRegistry = globalRegistry,
): FieldError | null {
  const field = describeField(node, scope, materials);
  if (!field) return null;

  const issue = validateFieldValue(field, scope);
  if (errors) {
    if (issue) errors[node.id] = issue.message;
    else delete errors[node.id];
  }
  return issue;
}

/** 错误列表转成一行行文案，便于 toast / 日志 */
export function errorsToText(errors: FieldError[]): string[] {
  return errors.map((item) => item.message);
}
