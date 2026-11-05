/** 物料公用解析：把 Schema 里便于手写的字符串形式统一成结构化数据 */

export interface OptionItem {
  label: string;
  value: string;
}

/** 支持 "A,B,C" 或 [{label,value}] 两种写法 */
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
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ label: s, value: s }));
  }
  return [];
}
