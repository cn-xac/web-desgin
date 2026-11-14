/**
 * 序列化：导出/存储前的压缩。
 * 目的：默认值不落库、空结构不落库，保证「导出 → 导入 → 再导出」diff 为空。
 */

import type { NodeSchema, PageSchema } from "./types";
import { resolveDefaults } from "../materials/catalog";

function isEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

export function compactNode(node: NodeSchema, dropDefaults = true): NodeSchema {
  const output: NodeSchema = { id: node.id, component: node.component };

  if (node.props) {
    const defaults = dropDefaults ? resolveDefaults(node.component, undefined) : {};
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.props)) {
      // 与物料默认值一致就不写进 Schema，这是「默认值不落库」的落地
      if (dropDefaults && JSON.stringify(defaults[key]) === JSON.stringify(value)) continue;
      if (value === undefined) continue;
      props[key] = value;
    }
    if (!isEmptyObject(props)) output.props = props;
  }

  if (node.style && !isEmptyObject(node.style)) output.style = node.style;
  if (node.directives?.length) output.directives = node.directives;
  if (node.visibility && !isEmptyObject(node.visibility)) output.visibility = node.visibility;
  if (node.events && !isEmptyObject(node.events)) output.events = node.events;
  if (node.rules?.length) output.rules = node.rules;
  if (node.children?.length) output.children = node.children.map((child) => compactNode(child, dropDefaults));

  return output;
}

export function compactPage(page: PageSchema): PageSchema {
  const output: PageSchema = {
    schemaVersion: page.schemaVersion,
    id: page.id,
    type: "page",
    children: page.children.map((node) => compactNode(node)),
  };

  if (page.meta && !isEmptyObject(page.meta)) output.meta = page.meta;
  if (page.state && !isEmptyObject(page.state)) output.state = page.state;
  if (page.dataSource && !isEmptyObject(page.dataSource)) output.dataSource = page.dataSource;

  return output;
}

export function toJSON(page: PageSchema, space = 2): string {
  return JSON.stringify(compactPage(page), null, space);
}
