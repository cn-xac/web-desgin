/**
 * 作用于 scope 数组路径的增删移辅助（框架无关）。
 *
 * 子表单（明细数组）的「添加 / 删除 / 上移 / 下移」本质都是对
 * `form.items` 这类数组做原地变更。这里直接对响应式 scope 的数组
 * 原地修改，Vue/React 的响应式系统会自然触发更新，无需额外通知。
 *
 * 路径支持数组下标（a.b[0].c），因此可配合 getByPath/setByPath 一起用。
 */
import type { Scope } from "./expression";
import { getByPath, setByPath } from "./expression";

/** 确保路径上存在数组；不存在则初始化为空数组并返回 */
export function ensureArray(scope: Scope, path: string): unknown[] {
  const current = getByPath(scope, path);
  if (Array.isArray(current)) return current;
  const arr: unknown[] = [];
  setByPath(scope, path, arr);
  return arr;
}

/** 向数组追加一项 */
export function pushArrayItem(scope: Scope, path: string, item: unknown): void {
  ensureArray(scope, path).push(item);
}

/** 按索引删除一项 */
export function removeArrayItem(scope: Scope, path: string, index: number): void {
  const arr = ensureArray(scope, path);
  if (index >= 0 && index < arr.length) arr.splice(index, 1);
}

/** 在数组内移动一项（from → to） */
export function moveArrayItem(scope: Scope, path: string, from: number, to: number): void {
  const arr = ensureArray(scope, path);
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
}
