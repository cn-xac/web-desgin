/**
 * Schema 树操作。全部为纯函数，入参是 children 数组，返回是否变更。
 * 树的 id 一旦生成永不复用；所有新增节点走 createNodeId。
 */

import type { NodeSchema } from "./types";

/**
 * 节点 id：时间戳无关的短随机串 + 进程内自增，足够避免碰撞，
 * 且不引入任何第三方依赖（core 要保持零依赖）。
 */
let counter = 0;

export function createNodeId(prefix = "n"): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${rand}${counter.toString(36)}`;
}

export interface NodeLocation {
  node: NodeSchema;
  /** 父节点，顶层为 null */
  parent: NodeSchema | null;
  /** 节点所在的兄弟数组 */
  list: NodeSchema[];
  index: number;
  /** 从根到当前节点的索引路径，如 [0, 2, 1] */
  indexPath: number[];
}

export function walk(
  nodes: NodeSchema[] | undefined,
  fn: (node: NodeSchema, parent: NodeSchema | null, indexPath: number[]) => void,
  parent: NodeSchema | null = null,
  base: number[] = [],
): void {
  (nodes ?? []).forEach((node, index) => {
    const path = [...base, index];
    fn(node, parent, path);
    if (node.children?.length) walk(node.children, fn, node, path);
  });
}

export function findLocation(
  nodes: NodeSchema[] | undefined,
  id: string,
  parent: NodeSchema | null = null,
  base: number[] = [],
): NodeLocation | null {
  const list = nodes ?? [];
  for (let index = 0; index < list.length; index++) {
    const node = list[index];
    const path = [...base, index];
    if (node.id === id) return { node, parent, list, index, indexPath: path };
    if (node.children?.length) {
      const found = findLocation(node.children, id, node, path);
      if (found) return found;
    }
  }
  return null;
}

export function findNode(nodes: NodeSchema[] | undefined, id: string): NodeSchema | null {
  return findLocation(nodes, id)?.node ?? null;
}

export function countNodes(nodes: NodeSchema[] | undefined): number {
  let count = 0;
  walk(nodes, () => {
    count += 1;
  });
  return count;
}

export function maxDepth(nodes: NodeSchema[] | undefined, depth = 1): number {
  let max = depth;
  (nodes ?? []).forEach((node) => {
    if (node.children?.length) max = Math.max(max, maxDepth(node.children, depth + 1));
  });
  return max;
}

/** 目标节点是否为 sourceId 的子孙，用于阻止把父节点拖进自己内部 */
export function isDescendant(nodes: NodeSchema[] | undefined, ancestorId: string, candidateId: string): boolean {
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor) return false;
  let hit = false;
  walk(ancestor.children, (node) => {
    if (node.id === candidateId) hit = true;
  });
  return hit;
}

export type DropPosition = "inside" | "before" | "after";

/**
 * 插入节点。
 * - targetId 为空 → 追加到根
 * - inside → 追加到目标节点 children 末尾（要求 acceptsChildren）
 * - before / after → 插到目标节点的兄弟数组
 */
export function insertNode(
  rootChildren: NodeSchema[],
  node: NodeSchema,
  targetId: string | null,
  position: DropPosition,
  acceptsChildren: (component: string) => boolean,
): boolean {
  if (!targetId) {
    rootChildren.push(node);
    return true;
  }

  const location = findLocation(rootChildren, targetId);
  if (!location) {
    rootChildren.push(node);
    return true;
  }

  if (position === "inside") {
    if (!acceptsChildren(location.node.component)) {
      // 目标不接受子节点 → 退化为插到其后
      location.list.splice(location.index + 1, 0, node);
      return true;
    }
    location.node.children = location.node.children ?? [];
    location.node.children.push(node);
    return true;
  }

  const at = position === "before" ? location.index : location.index + 1;
  location.list.splice(at, 0, node);
  return true;
}

export function removeNode(rootChildren: NodeSchema[], id: string): NodeSchema | null {
  const location = findLocation(rootChildren, id);
  if (!location) return null;
  location.list.splice(location.index, 1);
  return location.node;
}

export function moveNode(rootChildren: NodeSchema[], id: string, delta: number): boolean {
  const location = findLocation(rootChildren, id);
  if (!location) return false;
  const next = location.index + delta;
  if (next < 0 || next >= location.list.length) return false;
  const [node] = location.list.splice(location.index, 1);
  location.list.splice(next, 0, node);
  return true;
}

/** 移动节点到新位置；不允许移动到自己内部 */
export function relocateNode(
  rootChildren: NodeSchema[],
  id: string,
  targetId: string | null,
  position: DropPosition,
  acceptsChildren: (component: string) => boolean,
): boolean {
  if (id === targetId) return false;
  if (targetId && isDescendant(rootChildren, id, targetId)) return false;

  const location = findLocation(rootChildren, id);
  if (!location) return false;

  // 同层相邻位置视为无操作
  if (targetId) {
    const target = findLocation(rootChildren, targetId);
    if (target && target.list === location.list) {
      if (target.index === location.index || target.index === location.index + 1) {
        if (position !== "inside") return false;
      }
    }
  }

  location.list.splice(location.index, 1);
  return insertNode(rootChildren, location.node, targetId, position, acceptsChildren);
}

/** 深拷贝并重新生成全部 id（复制/粘贴用） */
export function cloneWithNewIds(node: NodeSchema): NodeSchema {
  return {
    ...node,
    id: createNodeId(),
    props: node.props ? JSON.parse(JSON.stringify(node.props)) : undefined,
    style: node.style ? { ...node.style } : undefined,
    directives: node.directives ? JSON.parse(JSON.stringify(node.directives)) : undefined,
    events: node.events ? JSON.parse(JSON.stringify(node.events)) : undefined,
    rules: node.rules ? JSON.parse(JSON.stringify(node.rules)) : undefined,
    children: node.children?.map(cloneWithNewIds),
  };
}

/** 面包屑：从根到目标节点的链路 */
export function getBreadcrumb(rootChildren: NodeSchema[], id: string): NodeSchema[] {
  const trail: NodeSchema[] = [];
  const seek = (nodes: NodeSchema[] | undefined): boolean => {
    for (const node of nodes ?? []) {
      trail.push(node);
      if (node.id === id) return true;
      if (node.children?.length && seek(node.children)) return true;
      trail.pop();
    }
    return false;
  };
  return seek(rootChildren) ? [...trail] : [];
}
