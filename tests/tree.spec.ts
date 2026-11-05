import { describe, expect, it } from "vitest";
import type { NodeSchema } from "@x-ac/design-core";
import {
  cloneWithNewIds,
  countNodes,
  createNodeId,
  findLocation,
  getBreadcrumb,
  insertNode,
  isDescendant,
  moveNode,
  relocateNode,
  removeNode,
  walk,
} from "@x-ac/design-core";

const acceptsChildren = (component: string) => ["card", "grid", "container"].includes(component);

function node(id: string, component = "text", children?: NodeSchema[]): NodeSchema {
  return { id, component, props: {}, ...(children ? { children } : {}) };
}

function tree(): NodeSchema[] {
  return [node("card1", "card", [node("grid1", "grid", [node("in1", "input"), node("in2", "input")])]), node("btn1", "button")];
}

describe("树操作", () => {
  it("createNodeId 不重复", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createNodeId()));
    expect(ids.size).toBe(500);
  });

  it("walk 覆盖所有节点并给出父节点", () => {
    const visited: Array<{ id: string; parent: string | null }> = [];
    walk(tree(), (item, parent) => visited.push({ id: item.id, parent: parent?.id ?? null }));
    expect(visited).toHaveLength(5);
    expect(visited.find((v) => v.id === "in1")?.parent).toBe("grid1");
    expect(visited[0].parent).toBeNull();
  });

  it("insertNode inside 追加到容器末尾", () => {
    const nodes = tree();
    insertNode(nodes, node("new1"), "grid1", "inside", acceptsChildren);
    expect(findLocation(nodes, "grid1")?.node.children?.map((c) => c.id)).toEqual(["in1", "in2", "new1"]);
  });

  it("insertNode before / after 插到兄弟位置", () => {
    const nodes = tree();
    insertNode(nodes, node("new1"), "in1", "before", acceptsChildren);
    insertNode(nodes, node("new2"), "in1", "after", acceptsChildren);
    const grid = findLocation(nodes, "grid1")?.node;
    expect(grid?.children?.map((c) => c.id)).toEqual(["new1", "in1", "new2", "in2"]);
  });

  it("目标不接受子节点时 inside 退化为插到其后", () => {
    const nodes = tree();
    insertNode(nodes, node("new1"), "btn1", "inside", acceptsChildren);
    expect(nodes.map((n) => n.id)).toEqual(["card1", "btn1", "new1"]);
  });

  it("targetId 为空时追加到根", () => {
    const nodes = tree();
    insertNode(nodes, node("new1"), null, "inside", acceptsChildren);
    expect(nodes[nodes.length - 1].id).toBe("new1");
  });

  it("不允许把父节点拖进自己的子孙", () => {
    const nodes = tree();
    expect(isDescendant(nodes, "card1", "in1")).toBe(true);
    expect(relocateNode(nodes, "card1", "in1", "inside", acceptsChildren)).toBe(false);
    expect(nodes).toHaveLength(2);
  });

  it("同层移动到原位置视为无操作", () => {
    const nodes = tree();
    expect(relocateNode(nodes, "in1", "in2", "before", acceptsChildren)).toBe(false);
    expect(findLocation(nodes, "grid1")?.node.children?.map((c) => c.id)).toEqual(["in1", "in2"]);
  });

  it("跨容器移动会从原位置移除", () => {
    const nodes = tree();
    expect(relocateNode(nodes, "in1", "btn1", "after", acceptsChildren)).toBe(true);
    expect(findLocation(nodes, "in1")?.parent).toBeNull();
    expect(nodes.map((n) => n.id)).toEqual(["card1", "btn1", "in1"]);
  });

  it("removeNode 返回被删节点", () => {
    const nodes = tree();
    const removed = removeNode(nodes, "grid1");
    expect(removed?.id).toBe("grid1");
    expect(findLocation(nodes, "grid1")).toBeNull();
    expect(removeNode(nodes, "not-exist")).toBeNull();
  });

  it("moveNode 只能同层移动", () => {
    const nodes = tree();
    expect(moveNode(nodes, "btn1", -1)).toBe(true);
    expect(nodes.map((n) => n.id)).toEqual(["btn1", "card1"]);
    expect(moveNode(nodes, "btn1", -1)).toBe(false);
  });

  it("cloneWithNewIds 深拷贝且 id 全新", () => {
    const source = tree()[0];
    const copy = cloneWithNewIds(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.children?.[0].id).not.toBe(source.children?.[0].id);
    expect(copy.children?.length).toBe(source.children?.length);
    expect(countNodes([copy])).toBe(countNodes([source]));
  });

  it("getBreadcrumb 返回根到目标的链路", () => {
    const nodes = tree();
    expect(getBreadcrumb(nodes, "in2").map((n) => n.id)).toEqual(["card1", "grid1", "in2"]);
    expect(getBreadcrumb(nodes, "missing")).toEqual([]);
  });
});
