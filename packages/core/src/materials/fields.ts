import type { PropField, PropFieldGroup, PropOption } from "./types";

/** 分组顺序即属性面板的展示顺序；`advanced` 默认折叠 */
export const FIELD_GROUPS: PropFieldGroup[] = ["basic", "content", "data", "style", "advanced"];

/** 分组中文名。适配包追加字段时不必关心文案，面板按这里渲染 */
export const FIELD_GROUP_LABELS: Record<PropFieldGroup, string> = {
  basic: "基础",
  content: "内容",
  data: "数据",
  style: "外观",
  advanced: "高级",
};

export function fieldGroup(field: PropField): PropFieldGroup {
  return field.group ?? "basic";
}

/** 归一化 select 候选项：裸值补一份同名 label，面板只处理一种形状 */
export function fieldOptions(field: PropField): PropOption[] {
  return (field.options ?? []).map((option) =>
    typeof option === "object" && option !== null
      ? { label: String(option.label), value: option.value }
      : { label: String(option), value: option },
  );
}

/**
 * 按 key 去重合并字段：`extra` 里同名字段覆盖 `base`，但**保留 base 的位置**。
 *
 * 为什么需要它：core 的通用字段（size / disabled / clearable）与适配包追加的
 * Element Plus 专有字段必然重名。直接 concat 会让属性面板出现两个「尺寸」输入框，
 * 而且两个都会写同一个 prop —— 用户在两个框里改同一个值，看到的却是两份状态。
 */
export function mergeFields(base: PropField[], extra: PropField[]): PropField[] {
  if (!extra.length) return base.slice();

  const index = new Map<string, number>();
  const merged = base.slice();
  merged.forEach((field, i) => index.set(field.key, i));

  for (const field of extra) {
    const at = index.get(field.key);
    if (at === undefined) {
      index.set(field.key, merged.length);
      merged.push(field);
      continue;
    }
    // 覆盖时保留原位置；未显式标注的项沿用基础字段的设置，避免丢信息
    merged[at] = { ...merged[at], ...field };
  }

  return merged;
}

/** 按分组切片，返回固定顺序（空组不返回） */
export function groupFields(fields: PropField[]): Array<{ group: PropFieldGroup; fields: PropField[] }> {
  return FIELD_GROUPS.map((group) => ({
    group,
    fields: fields.filter((field) => fieldGroup(field) === group),
  })).filter((entry) => entry.fields.length > 0);
}
