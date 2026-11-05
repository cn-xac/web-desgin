/** 结构化深拷贝：Schema / state 都是纯 JSON 数据，直接走序列化最可预测 */
export function deepClone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
