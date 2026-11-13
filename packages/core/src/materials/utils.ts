/** 物料公用解析：把 Schema 里便于手写的字符串形式统一成结构化数据 */

export interface OptionItem {
  label: string;
  value: string;
}

/**
 * 解析选项。
 *
 * 支持两种写法：
 *
 * 1. **多行格式**（rSulo9 推荐的录入形态）：一行一个选项，
 *    名称(label)在前、值(value)在后，以空格（支持多个空格）隔开。
 *    ```
 *    技术中心   tech
 *    产品中心   product
 *    ```
 *    只有名称没写值时，值与名称相同。
 *
 * 2. **旧格式**（兼容历史 Schema）：单行、逗号分隔，如 `技术中心,产品中心`，
 *    此时每项的名称与值相同。
 *
 * 数组写法 [{ label, value }] 两种格式都支持。
 *
 * 已知取舍：条目内含逗号时会被当成条目分隔（历史 Schema 里没有这种写法）。
 */
export function parseOptions(raw: unknown): OptionItem[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return { label: String(obj.label ?? obj.value ?? ""), value: String(obj.value ?? obj.label ?? "") };
        }
        return { label: String(item ?? ""), value: String(item ?? "") };
      })
      .filter((item) => item.value !== "");
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    return parseOptionLines(text);
  }
  return [];
}

/**
 * 解析选项文本。
 *
 * 条目分隔：换行或逗号（中英文都算）。
 * 条目内：按**第一段空白**切成「名称 | 值」，所以名称与值之间可以打多个空格，
 * 值本身允许再含空格；没写值时值与名称相同。
 */
export function parseOptionLines(raw: string): OptionItem[] {
  return raw
    .split(/[\r\n]+/)
    .flatMap((line) => line.split(/[,，]/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.search(/\s/);
      if (at < 0) return { label: entry, value: entry };
      const label = entry.slice(0, at).trim();
      const value = entry.slice(at).trim();
      return { label, value: value || label };
    });
}

/**
 * 把选项数组序列化回多行文本（写进 Schema 的形态）。
 * 与 parseOptionLines 互为逆运算。
 */
export function formatOptionLines(items: OptionItem[]): string {
  return items
    .filter((item) => item && (item.label || item.value))
    .map((item) => {
      const label = String(item.label ?? "").trim();
      const value = String(item.value ?? "").trim();
      if (!value || value === label) return label;
      return `${label} ${value}`;
    })
    .join("\n");
}

/** 把任意形态的选项值转成多行文本（编辑弹窗打开时用，兼容历史 Schema） */
export function toOptionLines(raw: unknown): string {
  return formatOptionLines(parseOptions(raw));
}
