/**
 * 物料命名空间。
 *
 * Schema 里存的是「协议物料名」，形如 `ec-input`，而不是某个 UI 库的组件名（`ElInput`）。
 * `ec-` = engine component：由协议定义、由适配包实现，同一份 Schema 在不同 UI 库间语义一致。
 * 不带前缀的名字视为业务方自定义物料（如 `biz-org-tree`），由注册者自己负责适配。
 */

export const EC_PREFIX = "ec-";

/** 裸名 → 协议名。已带前缀的原样返回，保证幂等。 */
export function materialKey(name: string): string {
  if (!name) return name;
  return name.startsWith(EC_PREFIX) ? name : `${EC_PREFIX}${name}`;
}

/**
 * 协议名 → 裸名。
 * core 内部所有「按组件名分支」的逻辑都用裸名比较：
 * 前缀是 Schema 的事，分支判断不该跟着前缀走，否则每加一个前缀就要改一遍 switch。
 */
export function bareKey(key: string): string {
  return key.startsWith(EC_PREFIX) ? key.slice(EC_PREFIX.length) : key;
}

/** 协议物料：由引擎定义、适配包必须实现 */
export function isProtocolMaterial(key: string): boolean {
  return key.startsWith(EC_PREFIX);
}

/** 自定义物料：业务方注册，可移植性由注册者自行负责 */
export function isCustomMaterial(key: string): boolean {
  return !isProtocolMaterial(key);
}
