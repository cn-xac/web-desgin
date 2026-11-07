/**
 * 属性可移植性三档（ADR-14）。
 *
 * 设计时用 A、渲染时用 B 是罕见但真实存在的场景（同一份 Schema 被两个应用消费）。
 * 「简单映射」只够把界面画出来，不够保住行为：
 *   - 输入框在 A 限制 10 个字，B 若丢掉 maxlength，就变成能输 100 个字 —— 这是数据事故；
 *   - size / effect / variant 丢掉只是丑一点 —— 可以接受。
 * 所以属性必须分档，而不是笼统地「尽量映射」。
 */
import type { Material, Portability, PropField } from "./types";

export type { Portability };

export const PORTABILITY_LABELS: Record<Portability, string> = {
  behavior: "行为",
  content: "内容",
  visual: "视觉",
};

/** 行为属性：缺失会改变数据或交互结果，跨库时必须映射 */
const BEHAVIOR_KEYS = new Set([
  "maxlength",
  "maxLength",
  "minlength",
  "minLength",
  "min",
  "max",
  "precision",
  "step",
  "disabled",
  "readonly",
  "readOnly",
  "multiple",
  "clearable",
  "filterable",
  "allowClear",
  "format",
  "valueFormat",
  "rows",
  "showWordLimit",
  "modelValue",
  "data",
  "dict",
  "checkStrictly",
  "rowKey",
  "allowHalf",
  "closable",
  "multiple",
]);

/** 内容属性：缺失会让页面文案或选项丢失，跨库时必须映射 */
const CONTENT_KEYS = new Set([
  "label",
  "text",
  "title",
  "placeholder",
  "options",
  "columns",
  "description",
  "content",
  "href",
  "src",
  "alt",
  "activeText",
  "inactiveText",
  "emptyText",
]);

/**
 * 给物料的每个字段固化一个显式 portability 值。
 *
 * 显式标注优先，未标注的按键名推断 —— 这样 97 个既有字段不必逐条手写，
 * 运行时拿到的仍然全是有档位的字段；语义有歧义的同名字段（如 `type`
 * 在日期里是数据格式、在按钮里是配色）由物料清单显式覆盖。
 * 纯函数，不修改入参。
 */
export function tagPortability(material: Material): Material {
  return {
    ...material,
    fields: material.fields.map((field) => ({
      ...field,
      portability: field.portability ?? fieldPortability(field),
    })),
  };
}

/**
 * 字段的可移植性。显式标注优先；未标注时按键名推断。
 * 推断只是兜底，正式物料应在注册时显式标注，避免「新增字段默默归到 visual」。
 */
export function fieldPortability(field: Pick<PropField, "key" | "portability">): Portability {
  if (field.portability) return field.portability;
  if (BEHAVIOR_KEYS.has(field.key)) return "behavior";
  if (CONTENT_KEYS.has(field.key)) return "content";
  return "visual";
}

export interface PortabilitySummary {
  behavior: string[];
  content: string[];
  visual: string[];
}

/** 汇总一个物料的属性分档，供跨库映射检查与文档生成使用 */
export function summarizePortability(fields: PropField[]): PortabilitySummary {
  const summary: PortabilitySummary = { behavior: [], content: [], visual: [] };
  for (const field of fields) summary[fieldPortability(field)].push(field.key);
  return summary;
}
