/**
 * Schema 校验。设计器保存前、导入时都走这里。
 * 分级：error 阻断保存，warning 只提示（未知组件按规范应降级渲染而不是报错）。
 */

import type { NodeSchema, PageSchema } from "./types";
import type { ExternalDataSource } from "../data/external";
import { compilePattern, getRuleDefinition, RULE_TYPES } from "../validation/rules";
import { materialKey } from "../materials/keys";
import {
  CONDITION_AGGREGATES,
  CONDITION_MODE_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
} from "../visibility/types";
import { validateAdvancedExpression } from "../visibility/evaluate";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

const SEMVER = /^\d+\.\d+\.\d+$/;
const DIRECTIVE_NAMES = new Set(["show", "if", "for"]);
const CONDITION_MODES = new Set<string>(CONDITION_MODE_OPTIONS.map((option) => option.value));
const CONDITION_OPS = new Set<string>(CONDITION_OPERATOR_OPTIONS.map((option) => option.value));
const CONDITION_AGGS = new Set<string>(CONDITION_AGGREGATES.map((option) => option.value));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePage(input: unknown, knownComponents?: Set<string>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const error = (path: string, message: string) => issues.push({ level: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ level: "warning", path, message });

  if (!isRecord(input)) {
    error("$", "Schema 必须是一个对象");
    return finish(issues);
  }

  if (typeof input.schemaVersion !== "string" || !SEMVER.test(input.schemaVersion)) {
    error("schemaVersion", "schemaVersion 必须是 x.y.z 形式的语义化版本");
  }
  if (typeof input.id !== "string" || !input.id.trim()) {
    error("id", "页面 id 不能为空");
  }
  if (input.type !== "page") {
    error("type", '根节点 type 必须为 "page"');
  }
  if (!Array.isArray(input.children)) {
    error("children", "children 必须是数组");
    return finish(issues);
  }

  if (input.meta !== undefined) {
    if (!isRecord(input.meta)) {
      error("meta", "meta 必须是对象");
    } else if (input.meta.device !== undefined && !["pc", "pad", "h5"].includes(String(input.meta.device))) {
      error("meta.device", 'device 只能是 "pc" / "pad" / "h5"');
    }
  }

  if (input.state !== undefined && !isRecord(input.state)) {
    error("state", "state 必须是对象");
  }

  if (input.dataSource !== undefined && !isRecord(input.dataSource)) {
    error("dataSource", "dataSource 必须是对象");
  }

  if (input.externalSources !== undefined) {
    if (!isRecord(input.externalSources)) {
      error("externalSources", "externalSources 必须是对象");
    } else {
      for (const [key, rawSource] of Object.entries(input.externalSources)) {
        const sPath = `externalSources.${key}`;
        if (!isRecord(rawSource)) {
          error(sPath, "外部数据源必须是对象");
          continue;
        }
        const source = rawSource as unknown as ExternalDataSource;
        if (typeof source.id !== "string" || !source.id.trim()) {
          error(`${sPath}.id`, "外部数据源必须包含 id");
        } else if (source.id !== key) {
          error(`${sPath}.id`, `外部数据源 id 必须与键名一致：${key}`);
        }
        if (typeof source.url !== "string" || !source.url.trim()) {
          error(`${sPath}.url`, "外部数据源必须包含 url");
        }
        if (source.responses !== undefined && !Array.isArray(source.responses)) {
          error(`${sPath}.responses`, "responses 必须是数组");
        }
      }
    }
  }

  const seen = new Set<string>();

  const visit = (nodes: unknown, path: string) => {
    if (!Array.isArray(nodes)) {
      error(path, "children 必须是数组");
      return;
    }
    nodes.forEach((raw, index) => {
      const at = `${path}[${index}]`;
      if (!isRecord(raw)) {
        error(at, "节点必须是对象");
        return;
      }
      const node = raw as unknown as NodeSchema;

      if (typeof node.id !== "string" || !node.id.trim()) {
        error(`${at}.id`, "节点 id 不能为空");
      } else if (seen.has(node.id)) {
        error(`${at}.id`, `节点 id 重复：${node.id}`);
      } else {
        seen.add(node.id);
      }

      if (typeof node.component !== "string" || !node.component.trim()) {
        error(`${at}.component`, "component 不能为空");
      } else if (knownComponents && !knownComponents.has(node.component) && !knownComponents.has(materialKey(node.component))) {
        warn(`${at}.component`, `未注册的组件 ${node.component}，渲染时会降级为占位块`);
      }

      if (node.props !== undefined && !isRecord(node.props)) {
        error(`${at}.props`, "props 必须是对象");
      }
      if (node.style !== undefined && !isRecord(node.style)) {
        error(`${at}.style`, "style 必须是对象");
      }

      if (node.directives !== undefined) {
        if (!Array.isArray(node.directives)) {
          error(`${at}.directives`, "directives 必须是数组");
        } else {
          node.directives.forEach((directive, di) => {
            if (!isRecord(directive) || typeof directive.name !== "string") {
              error(`${at}.directives[${di}]`, "指令必须包含 name");
              return;
            }
            if (!DIRECTIVE_NAMES.has(directive.name)) {
              error(`${at}.directives[${di}].name`, `不支持的指令 ${directive.name}`);
            }
            if (directive.name === "for" && typeof directive.value !== "string") {
              error(`${at}.directives[${di}].value`, "for 指令必须给出遍历表达式");
            }
          });
        }
      }

      if (node.visibility !== undefined) {
        if (!isRecord(node.visibility)) {
          error(`${at}.visibility`, "visibility 必须是对象");
        } else {
          (["show", "hide"] as const).forEach((kind) => {
            const group = node.visibility?.[kind];
            if (group === undefined) return;
            const groupPath = `${at}.visibility.${kind}`;
            if (!isRecord(group) || !Array.isArray(group.rows) || !CONDITION_MODES.has(String(group.mode))) {
              error(groupPath, "条件组必须包含合法 mode 与 rows 数组");
              return;
            }
            const rows = group.rows as unknown[];
            rows.forEach((rawRow, ri) => {
              const rowPath = `${groupPath}.rows[${ri}]`;
              if (!isRecord(rawRow)) {
                error(rowPath, "条件必须是对象");
                return;
              }
              const hasLeft = typeof rawRow.left === "string" && rawRow.left.trim() !== "";
              const hasOperator = typeof rawRow.operator === "string" && CONDITION_OPS.has(rawRow.operator);
              if (rawRow.left !== undefined && typeof rawRow.left !== "string") {
                error(`${rowPath}.left`, "left 必须是绑定路径字符串");
              }
              if (rawRow.operator !== undefined && !CONDITION_OPS.has(String(rawRow.operator))) {
                error(`${rowPath}.operator`, `不支持的条件关系 ${String(rawRow.operator)}`);
              }
              if (rawRow.aggregate !== undefined && !CONDITION_AGGS.has(String(rawRow.aggregate))) {
                error(`${rowPath}.aggregate`, "不支持的聚合口径，仅支持 sum / avg / min / max");
              }
              // 要么「左元素 + 关系 + 右值」，要么「仅值」，不允许半成品
              if (hasLeft !== hasOperator) {
                error(rowPath, "left 与 operator 必须同时存在，或同时省略（仅值形态）");
              }
            });
            if (group.mode === "advanced" && typeof group.expression === "string") {
              const message = validateAdvancedExpression(group.expression, rows.length);
              if (message) error(`${groupPath}.expression`, message);
            }
          });
        }
      }

      if (node.events !== undefined) {
        if (!isRecord(node.events)) {
          error(`${at}.events`, "events 必须是对象");
        } else {
          Object.entries(node.events).forEach(([eventName, actions]) => {
            if (!Array.isArray(actions)) {
              error(`${at}.events.${eventName}`, "事件处理器必须是数组");
              return;
            }
            actions.forEach((action, ai) => {
              if (!isRecord(action) || typeof action.action !== "string" || !action.action.trim()) {
                error(`${at}.events.${eventName}[${ai}].action`, "动作必须包含预注册的 action 名");
              }
              if (isRecord(action) && action.args !== undefined && !isRecord(action.args)) {
                error(`${at}.events.${eventName}[${ai}].args`, "动作参数必须是对象");
              }
            });
          });
        }
      }

      if (node.rules !== undefined) {
        if (!Array.isArray(node.rules)) {
          error(`${at}.rules`, "rules 必须是数组");
        } else {
          // 交叉校验用：min > max 这类配置永远不可能通过，属于配置错误而非用户输入错误
          const bounds = new Map<string, number>();

          node.rules.forEach((rule, ri) => {
            const rulePath = `${at}.rules[${ri}]`;
            if (!isRecord(rule)) {
              error(rulePath, "规则必须是对象");
              return;
            }
            if (typeof rule.type !== "string" || !RULE_TYPES.has(rule.type)) {
              error(`${rulePath}.type`, `不支持的规则类型 ${String(rule.type)}`);
              return;
            }

            const definition = getRuleDefinition(rule.type)!;
            if (definition.valueKind === "number" || definition.valueKind === "length") {
              if (typeof rule.value !== "number" || !Number.isFinite(rule.value)) {
                error(`${rulePath}.value`, "该规则需要一个数字");
              } else if (definition.valueKind === "length" && rule.value < 0) {
                error(`${rulePath}.value`, "长度不能为负数");
              } else {
                bounds.set(rule.type, rule.value);
              }
            }

            if (definition.valueKind === "regex") {
              if (typeof rule.value !== "string" || !rule.value.trim()) {
                error(`${rulePath}.value`, "正则规则需要一个表达式");
              } else if (!compilePattern(rule.value, typeof rule.flags === "string" ? rule.flags : "")) {
                error(`${rulePath}.value`, "正则表达式无法编译，请检查括号与转义");
              }
            }

            if (rule.when !== undefined && typeof rule.when !== "string") {
              error(`${rulePath}.when`, "when 必须是表达式字符串");
            }
            if (rule.message !== undefined && typeof rule.message !== "string") {
              error(`${rulePath}.message`, "message 必须是字符串");
            }
          });

          if (bounds.has("min") && bounds.has("max") && bounds.get("min")! > bounds.get("max")!) {
            error(`${at}.rules`, "最小值不能大于最大值");
          }
          if (
            bounds.has("minLength") &&
            bounds.has("maxLength") &&
            bounds.get("minLength")! > bounds.get("maxLength")!
          ) {
            error(`${at}.rules`, "最短长度不能大于最长长度");
          }
        }
      }

      if (node.children !== undefined) visit(node.children, `${at}.children`);
    });
  };

  visit(input.children, "children");

  // 页面级必须能拿到标题，否则列表页无法展示
  if (!isRecord(input.meta) || typeof input.meta.title !== "string" || !input.meta.title.trim()) {
    warn("meta.title", "建议补充页面标题");
  }

  return finish(issues);
}

function finish(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return { valid: errors.length === 0, errors, warnings, issues };
}

/** 导入/保存前的强校验，失败抛出可读错误 */
export function assertValidPage(input: unknown, knownComponents?: Set<string>): PageSchema {
  const result = validatePage(input, knownComponents);
  if (!result.valid) {
    const detail = result.errors
      .slice(0, 5)
      .map((e) => `${e.path}: ${e.message}`)
      .join("；");
    throw new Error(detail || "Schema 校验未通过");
  }
  return input as PageSchema;
}
