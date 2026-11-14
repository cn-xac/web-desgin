/**
 * 条件配置的可选元素清单（设计期用）。
 *
 * 作用域规则（r5u4Ul 已定口径，单向隔离）：
 * - 配置方在**子表单内**：只能选同一子表单内的元素，设计期与运行时都不越界；
 * - 配置方在**子表单外**：可以选任意元素，包含子表单内字段；选中明细字段时
 *   必须指定聚合口径（缺省求和），因为一个字段对应多行值。
 *
 * 清单复用 `data/bindable.ts` 的绑定路径规则，保证「能绑的」和「能当条件的」同源。
 */

import { collectBindableElements, type BindableElement } from "../data/bindable";
import { MATERIALS } from "../materials/catalog";
import { createRegistry, type MaterialRegistry } from "../materials/registry";
import type { NodeSchema, PageSchema } from "../schema/types";

export interface ConditionElement extends BindableElement {
  /** 所属子表单容器 id；顶层元素为 null */
  subformId: string | null;
  /** 是否为子表单明细内的字段 */
  inSubform: boolean;
  /** 当前配置方引用它时是否需要选聚合口径 */
  requiresAggregate: boolean;
}

export interface CollectConditionOptions {
  /** 正在配置条件的节点 id（即控制目标自身） */
  nodeId?: string;
  registry?: MaterialRegistry;
}

interface Owner {
  subformId: string | null;
  inSubform: boolean;
}

/** 遍历页面树，为每个节点标注它隶属于哪个子表单 */
function collectOwners(
  page: PageSchema,
  registry: MaterialRegistry,
): { owners: Map<string, Owner>; subformIds: Set<string> } {
  const owners = new Map<string, Owner>();
  const subformIds = new Set<string>();

  const walk = (nodes: NodeSchema[] | undefined, parentSubform: string | null): void => {
    for (const node of nodes ?? []) {
      const material = registry.get(node.component);
      if (material?.kind === "subform") {
        subformIds.add(node.id);
        owners.set(node.id, { subformId: parentSubform, inSubform: parentSubform !== null });
        walk(node.children, node.id);
        continue;
      }
      owners.set(node.id, { subformId: parentSubform, inSubform: parentSubform !== null });
      walk(node.children, parentSubform);
    }
  };

  walk(page.children, null);
  return { owners, subformIds };
}

export function collectConditionElements(
  page: PageSchema,
  options: CollectConditionOptions = {},
): ConditionElement[] {
  const registry = options.registry ?? createRegistry(MATERIALS);
  const { owners, subformIds } = collectOwners(page, registry);
  const target = options.nodeId ? owners.get(options.nodeId) : undefined;
  const ownerSubform = target?.inSubform ? target.subformId : null;

  return collectBindableElements(page, { registry })
    .filter((element) => element.nodeId !== options.nodeId)
    .filter((element) => {
      if (!ownerSubform) return true;
      const owner = owners.get(element.nodeId);
      return owner?.subformId === ownerSubform;
    })
    .map((element) => {
      const owner = owners.get(element.nodeId);
      const inSubform = owner?.inSubform ?? false;
      const isContainer = subformIds.has(element.nodeId);
      return {
        ...element,
        subformId: owner?.subformId ?? null,
        inSubform: inSubform || isContainer,
        // 子表单外的配置方引用明细字段 / 明细容器时，需要聚合为单个值
        requiresAggregate: !ownerSubform && (inSubform || isContainer),
      };
    });
}
