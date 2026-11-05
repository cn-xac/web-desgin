/**
 * 表单数据导出（框架无关）。
 *
 * 与 `export/html.ts` 的区别：
 * - html.ts 导的是「页面长什么样」；
 * - 这里导的是「用户填了什么」，用于提交、落库、联调、给测试当夹具。
 */

import type { PageSchema } from "../schema/types";
import type { Scope } from "../schema/expression";
import { setByPath } from "../schema/expression";
import {
  collectFields,
  validateData,
  type FieldError,
  type FormField,
} from "../validation/engine";
import { isEmptyValue } from "../validation/rules";
import { deepClone } from "../utils/clone";

export interface DataExportOptions {
  /** 空值是否也导出，默认 false（空字段不写进结果，避免脏数据） */
  includeEmpty?: boolean;
  /** 导出时是否顺带校验，默认 true */
  validate?: boolean;
}

export interface ExportedField {
  nodeId: string;
  path: string;
  label: string;
  component: string;
  value: unknown;
}

export interface DataExportResult {
  valid: boolean;
  /** 按绑定路径还原成嵌套对象：form.name → { form: { name } } */
  data: Record<string, unknown>;
  /** 扁平视图：{ "form.name": "张三" }，便于丢给接口或表格组件 */
  flat: Record<string, unknown>;
  fields: ExportedField[];
  /** 没有绑定 modelValue 的字段：无法确定 key，只做提示 */
  unbound: Array<{ nodeId: string; label: string }>;
  errors: FieldError[];
  exportedAt: string;
}

/**
 * 收集页面表单数据。
 * 同一个路径被多个控件绑定时，后者覆盖前者（与渲染顺序一致）。
 */
export function exportData(
  page: PageSchema,
  scope: Scope,
  options: DataExportOptions = {},
  now: Date = new Date(),
): DataExportResult {
  const { includeEmpty = false, validate = true } = options;
  const fields: FormField[] = collectFields(page, scope);

  const data: Record<string, unknown> = {};
  const flat: Record<string, unknown> = {};
  const exported: ExportedField[] = [];
  const unbound: Array<{ nodeId: string; label: string }> = [];

  for (const field of fields) {
    if (!field.path) {
      unbound.push({ nodeId: field.nodeId, label: field.label });
      continue;
    }

    const value = deepClone(field.value);
    flat[field.path] = value;
    exported.push({
      nodeId: field.nodeId,
      path: field.path,
      label: field.label,
      component: field.component,
      value,
    });

    if (!includeEmpty && isEmptyValue(value)) continue;
    setByPath(data, field.path, value);
  }

  const result = validate
    ? validateData(page, scope, { fields })
    : { valid: true, errors: [] as FieldError[] };

  return {
    valid: result.valid,
    data,
    flat,
    fields: exported,
    unbound,
    errors: result.errors,
    exportedAt: now.toISOString(),
  };
}

export interface DataJSONOptions {
  space?: number;
  /** true 时连同 valid / errors / exportedAt 一起输出，便于排查 */
  includeMeta?: boolean;
}

export function toDataJSON(result: DataExportResult, options: DataJSONOptions = {}): string {
  const { space = 2, includeMeta = false } = options;
  const payload = includeMeta
    ? {
        valid: result.valid,
        exportedAt: result.exportedAt,
        data: result.data,
        errors: result.errors,
      }
    : result.data;
  return JSON.stringify(payload, null, space);
}

/** 导出结果摘要，给宿主做一行提示 */
export function describeExport(result: DataExportResult): string {
  const filled = result.fields.length;
  if (result.valid) return `已收集 ${filled} 个字段，校验通过`;
  return `已收集 ${filled} 个字段，${result.errors.length} 项未通过校验`;
}
