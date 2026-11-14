/**
 * 条件求值与显隐判定（纯函数，core 内不访问任何浏览器 API）。
 *
 * 优先级（@todo r5u4Ul 已定口径）：
 *   外部 force → 本地 show → 本地 hide → 外部非强制 → 旧 directives → 默认显示。
 *   「显示高于隐藏」= show 命中时忽略 hide。
 */

import { evaluate, getByPath, resolveBoolean, resolveValue, type Scope } from "../schema/expression";
import type { NodeSchema } from "../schema/types";
import type {
  ConditionAggregate,
  ConditionGroup,
  ConditionOperator,
  ConditionRow,
  ExternalVisibility,
  VisibilityContext,
  VisibilityDecision,
} from "./types";

const UNARY_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
  "empty",
  "notEmpty",
  "truthy",
  "falsy",
]);

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

/** 右侧值：只有显式 `{{...}}` 才按作用域取值，其余一律字面量 */
function resolveOperand(value: unknown, scope: Scope): unknown {
  if (typeof value !== "string") return value;
  return value.includes("{{") ? resolveValue(value, scope) : value;
}

/** 仅值形态：整串插值取原始值，裸字符串按受限表达式求值 */
function resolveBooleanOperand(value: unknown, scope: Scope): boolean {
  if (typeof value !== "string") return Boolean(value);
  const trimmed = value.trim();
  if (trimmed.includes("{{")) return Boolean(resolveValue(trimmed, scope));
  return Boolean(evaluate(trimmed, scope));
}

const SERIES_PATTERN = /\[(\d+)\]/g;

/**
 * 把带 `[0]` 占位的路径展开成「所有行的取值序列」。
 * 支持嵌套明细，例如 `form.orders[0].goods[0].price`。
 * 路径里没有数组占位时返回 null，表示这不是明细字段。
 */
function expandSeries(value: unknown, path: string): unknown[] | null {
  const match = SERIES_PATTERN.exec(path);
  SERIES_PATTERN.lastIndex = 0;
  if (!match) return null;

  const head = path.slice(0, match.index).replace(/\.$/, "");
  const list = head ? getByPath(value as Scope, head) : value;
  if (!Array.isArray(list)) return null;

  const tail = path.slice(match.index + match[0].length).replace(/^\./, "");
  const out: unknown[] = [];
  for (const row of list) {
    if (!tail) {
      out.push(row);
      continue;
    }
    const nested = expandSeries(row, tail);
    if (nested === null) out.push(getByPath(row as Scope, tail));
    else out.push(...nested);
  }
  return out;
}

function collectSeries(scope: Scope, path: string): unknown[] | null {
  return expandSeries(scope, path);
}

/** 缺省聚合口径为求和，与 rtHicl「数据计算功能」保持一致 */
export function aggregateSeries(values: unknown[], aggregate: ConditionAggregate = "sum"): unknown {
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];

  const numbers = values.map(toNumber).filter((n): n is number => n !== null);
  if (numbers.length === values.length || numbers.length > 0) {
    switch (aggregate) {
      case "sum":
        return numbers.reduce((a, b) => a + b, 0);
      case "avg":
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
      case "min":
        return Math.min(...numbers);
      case "max":
        return Math.max(...numbers);
    }
  }

  // 非数值序列：min / max 按字典序，sum / avg 保留序列交给关系运算符处理
  const strings = values.map((v) => String(v));
  if (aggregate === "min") return strings.slice().sort()[0];
  if (aggregate === "max") return strings.slice().sort().reverse()[0];
  return values;
}

/** 无聚合时，把设计期 `[0]` 占位替换成当前行下标 */
function withRowIndex(path: string, rowIndex: number | undefined): string {
  if (rowIndex === undefined) return path;
  return path.replace(SERIES_PATTERN, `[${rowIndex}]`);
}

function resolveLeft(row: ConditionRow, scope: Scope, ctx: VisibilityContext): unknown {
  if (!row.left) return undefined;
  if (row.aggregate) {
    const series = collectSeries(scope, row.left);
    if (series !== null) return aggregateSeries(series, row.aggregate);
  }
  return getByPath(scope, withRowIndex(row.left, ctx.rowIndex));
}

function compare(left: unknown, right: unknown, operator: ConditionOperator): boolean {
  const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

  switch (operator) {
    case "empty":
      return isEmptyValue(left);
    case "notEmpty":
      return !isEmptyValue(left);
    case "truthy":
      return Boolean(left);
    case "falsy":
      return !left;
    case "eq":
      if (Array.isArray(left)) return left.some((item) => text(item) === text(right));
      return text(left) === text(right);
    case "ne":
      if (Array.isArray(left)) return !left.some((item) => text(item) === text(right));
      return text(left) !== text(right);
    case "contains":
      if (Array.isArray(left)) {
        return left.some((item) => text(item) === text(right) || text(item).includes(text(right)));
      }
      return text(left).includes(text(right));
    case "notContains":
      return !compare(left, right, "contains");
    case "startsWith":
      return text(left).startsWith(text(right));
    case "endsWith":
      return text(left).endsWith(text(right));
    default:
      break;
  }

  const a = toNumber(left);
  const b = toNumber(right);
  if (a === null || b === null) {
    const x = text(left);
    const y = text(right);
    switch (operator) {
      case "gt":
        return x > y;
      case "gte":
        return x >= y;
      case "lt":
        return x < y;
      case "lte":
        return x <= y;
      default:
        return false;
    }
  }
  switch (operator) {
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
    default:
      return false;
  }
}

/** 单条条件求值。特殊场景（仅值、无关系）直接把 value 当布尔表达式 */
export function evaluateConditionRow(row: ConditionRow, scope: Scope, ctx: VisibilityContext = {}): boolean {
  if (!row.left || !row.operator) return resolveBooleanOperand(row.value, scope);
  const left = resolveLeft(row, scope, ctx);
  const right = UNARY_OPERATORS.has(row.operator) ? undefined : resolveOperand(row.value, scope);
  return compare(left, right, row.operator);
}

/* ------------------------- 高级组合表达式 ------------------------- */

type AdvancedToken =
  | { t: "row"; n: number }
  | { t: "and" | "or" | "not" | "lp" | "rp" };

function tokenizeAdvanced(expression: string): AdvancedToken[] | null {
  const tokens: AdvancedToken[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ t: ch === "(" ? "lp" : "rp" });
      i += 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < expression.length && /\d/.test(expression[j])) j += 1;
      tokens.push({ t: "row", n: Number(expression.slice(i, j)) });
      i = j;
      continue;
    }
    const rest = expression.slice(i).toLowerCase();
    if (rest.startsWith("and") || rest.startsWith("&&")) {
      tokens.push({ t: "and" });
      i += rest.startsWith("&&") ? 2 : 3;
      continue;
    }
    if (rest.startsWith("or") || rest.startsWith("||")) {
      tokens.push({ t: "or" });
      i += rest.startsWith("||") ? 2 : 2;
      continue;
    }
    if (rest.startsWith("not") || ch === "!") {
      tokens.push({ t: "not" });
      i += ch === "!" ? 1 : 3;
      continue;
    }
    return null;
  }
  return tokens;
}

/** 高级表达式静态校验：返回错误文案，合法返回 null */
export function validateAdvancedExpression(expression: string, rowCount: number): string | null {
  const tokens = tokenizeAdvanced(expression);
  if (!tokens || tokens.length === 0) return "高级表达式只能包含条件序号、and / or / not 与括号";
  let pos = 0;
  let depth = 0;
  let expectsRow = true;

  const parseAtom = (): boolean => {
    const token = tokens[pos];
    if (!token) return false;
    if (token.t === "not") {
      pos += 1;
      return parseAtom();
    }
    if (token.t === "lp") {
      pos += 1;
      depth += 1;
      if (!parseOr()) return false;
      const close = tokens[pos];
      if (!close || close.t !== "rp") return false;
      pos += 1;
      depth -= 1;
      expectsRow = false;
      return true;
    }
    if (token.t === "row") {
      if (!expectsRow || token.n < 1 || token.n > rowCount) return false;
      pos += 1;
      expectsRow = false;
      return true;
    }
    return false;
  };
  const parseAnd = (): boolean => {
    if (!parseAtom()) return false;
    while (tokens[pos]?.t === "and") {
      pos += 1;
      expectsRow = true;
      if (!parseAtom()) return false;
    }
    return true;
  };
  const parseOr = (): boolean => {
    if (!parseAnd()) return false;
    while (tokens[pos]?.t === "or") {
      pos += 1;
      expectsRow = true;
      if (!parseAnd()) return false;
    }
    return true;
  };

  if (!parseOr() || pos !== tokens.length || depth !== 0) return "高级表达式括号不匹配或序号越界";
  return null;
}

function evalAdvancedTokens(tokens: AdvancedToken[], results: boolean[]): boolean {
  let pos = 0;
  const atom = (): boolean => {
    const token = tokens[pos];
    if (!token) return false;
    if (token.t === "not") {
      pos += 1;
      return !atom();
    }
    if (token.t === "lp") {
      pos += 1;
      const value = or();
      if (tokens[pos]?.t === "rp") pos += 1;
      return value;
    }
    if (token.t === "row") {
      pos += 1;
      return results[token.n - 1] ?? false;
    }
    return false;
  };
  const and = (): boolean => {
    let value = atom();
    while (tokens[pos]?.t === "and") {
      pos += 1;
      const next = atom();
      value = value && next;
    }
    return value;
  };
  const or = (): boolean => {
    let value = and();
    while (tokens[pos]?.t === "or") {
      pos += 1;
      const next = and();
      value = value || next;
    }
    return value;
  };
  return or();
}

export function evaluateConditionGroup(
  group: ConditionGroup | undefined,
  scope: Scope,
  ctx: VisibilityContext = {},
): boolean {
  if (!group || group.rows.length === 0) return false;
  const results = group.rows.map((row) => evaluateConditionRow(row, scope, ctx));

  if (group.mode === "or") return results.some(Boolean);
  if (group.mode === "advanced") {
    const expression = (group.expression ?? "").trim();
    if (!expression) return results.every(Boolean);
    if (validateAdvancedExpression(expression, results.length)) return false;
    const tokens = tokenizeAdvanced(expression);
    return tokens ? evalAdvancedTokens(tokens, results) : false;
  }
  return results.every(Boolean);
}

/* --------------------------- 指令统一判定 --------------------------- */

/** if = 不渲染，show = display:none；for 由 resolveLoopInstances 单独处理 */
export function resolveDirectiveVisibility(node: NodeSchema, scope: Scope): VisibilityDecision {
  const directives = node.directives ?? [];
  if (directives.some((d) => d.name === "if" && !resolveBoolean(d.value, scope))) {
    return { visible: false, mode: "if", source: "directive" };
  }
  if (directives.some((d) => d.name === "show" && !resolveBoolean(d.value, scope))) {
    return { visible: false, mode: "show", source: "directive" };
  }
  return { visible: true, source: "default" };
}

/**
 * for 指令展开：统一处理裸表达式（Vue 原先包 `{{}}`，React / HTML 导出没包）。
 * 返回 null 表示该节点没有 for 指令。
 */
export function resolveLoopInstances(node: NodeSchema, scope: Scope): Array<{ key: string; scope: Scope }> | null {
  const directive = (node.directives ?? []).find((d) => d.name === "for");
  if (!directive) return null;
  const raw = (directive.value ?? "").trim();
  if (!raw) return [];
  const expression = raw.includes("{{") ? raw : `{{${raw}}}`;
  const list = resolveValue(expression, scope);
  const items = Array.isArray(list) ? list : [];
  const itemKey = directive.itemKey ?? "item";
  const indexKey = directive.indexKey ?? "index";
  return items.map((item, index) => ({
    key: `${node.id}-${index}`,
    scope: { ...scope, [itemKey]: item, [indexKey]: index },
  }));
}

/* ----------------------------- 总判定 ----------------------------- */

export function resolveVisibility(
  node: NodeSchema,
  scope: Scope,
  external?: ExternalVisibility,
  ctx: VisibilityContext = {},
): VisibilityDecision {
  const entry = external?.[node.id];

  if (entry?.force) {
    return {
      visible: entry.visible,
      source: "external-force",
      ...(entry.visible ? {} : { mode: "show" as const }),
    };
  }

  const config = node.visibility;
  if (config?.show && evaluateConditionGroup(config.show, scope, ctx)) {
    return { visible: true, source: "local-show" };
  }
  if (config?.hide && evaluateConditionGroup(config.hide, scope, ctx)) {
    return { visible: false, mode: "show", source: "local-hide" };
  }

  if (entry) {
    return {
      visible: entry.visible,
      source: "external",
      ...(entry.visible ? {} : { mode: "show" as const }),
    };
  }

  const directive = resolveDirectiveVisibility(node, scope);
  return directive.visible ? { visible: true, source: "default" } : directive;
}
