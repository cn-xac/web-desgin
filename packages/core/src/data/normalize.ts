import { getByPath } from "../schema/expression";
import type { OptionItem } from "../materials/utils";
import type { BindingContext, DataBinding } from "./types";

/**
 * 把后端响应归一化为前端可用的形态。
 *
 * 流程：
 * 1. 若 binding.transform 存在，先对「原始响应」做一次兜底转换（拿到数组或对象）；
 * 2. shape === 'form'：原样返回（已转换后的对象）；
 * 3. 选项形态（select/radio/checkbox）：
 *    - 经 listField 从包裹结构里取出数组；
 *    - 每个数组项按 labelField/valueField 映射为 OptionItem（value 强制转 string，与渲染器契约一致）。
 *
 * 归一化结果复用 materials/utils 的 OptionItem（{ label, value: string }）。
 */
export function normalize(binding: DataBinding, raw: unknown, ctx: BindingContext): unknown {
  const shape = binding.shape ?? "form";

  let data = raw;
  if (binding.transform) {
    data = binding.transform(raw, ctx);
  }

  if (shape === "form") {
    return data;
  }

  // 选项形态：拿到数组
  let list: unknown = data;
  if (binding.listField && data && typeof data === "object") {
    const extracted = getByPath(data as Record<string, unknown>, binding.listField);
    if (Array.isArray(extracted)) list = extracted;
  }
  if (!Array.isArray(list)) {
    // 非数组（如空对象 / 标量）无法映射为选项，降级为空列表，避免渲染崩溃
    list = [];
  }

  return (list as unknown[]).map((item) => toOption(item, binding));
}

/**
 * 单个数组项 → OptionItem。
 * 导出供「外部数据源的显示内容模板」复用：模板只改展示文本，值仍按 valueField 映射。
 */
export function toOption(item: unknown, binding: DataBinding): OptionItem {
  // 标量直接包成 { label, value }
  if (item === null || typeof item !== "object") {
    return { label: item == null ? "" : String(item), value: item == null ? "" : String(item) };
  }

  const obj = item as Record<string, unknown>;
  const label = getByPath(obj, binding.labelField ?? "label");
  const value = getByPath(obj, binding.valueField ?? "value");

  return {
    label: label == null ? "" : String(label),
    value: value == null ? "" : String(value),
  };
}
