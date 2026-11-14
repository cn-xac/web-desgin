import { describe, it, expect } from "vitest";
import {
  canOwnExternalSource,
  collectBindableData,
  collectBindableElements,
  filterBindableData,
  groupBindableData,
  type PageSchema,
} from "@x-ac/web-design-core";

/**
 * 可绑定数据清单（ruUqAF）。
 *
 * 清单是「设计器里能绑什么」的唯一事实来源，必须与运行时的绑定规则严格一致：
 * - 表单控件未显式设 modelValue → form.<节点ID>
 * - 显式设了 modelValue → 用显式路径
 * - 子表单内控件 → <明细路径>[组下标].<节点ID>
 * - 页面 state / dataSource 的键 → scope 顶层键
 */

function page(partial: Partial<PageSchema>): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "p1",
    type: "page",
    children: [],
    ...partial,
  };
}

const inputNode = (id: string, props: Record<string, unknown> = {}) => ({
  id,
  component: "ec-input",
  props,
});

describe("collectBindableData：可绑定数据清单", () => {
  it("页面状态的键直接是绑定路径，对象再展开一层", () => {
    const items = collectBindableData(
      page({ state: { count: 1, user: { name: "张三", age: 2 } } }),
    );
    const paths = items.map((item) => item.path);
    expect(paths).toContain("count");
    expect(paths).toContain("user");
    expect(paths).toContain("user.name");
    expect(paths).toContain("user.age");
    expect(items.find((item) => item.path === "user.name")?.kind).toBe("state");
  });

  it("表单控件按 form.<节点ID> 生成路径，并带上字段名", () => {
    const items = collectBindableData(
      page({ children: [inputNode("f1", { label: "姓名" })] }),
    );
    const item = items.find((entry) => entry.path === "form.f1");
    expect(item).toBeDefined();
    expect(item?.label).toBe("姓名");
    expect(item?.kind).toBe("field");
    expect(item?.hint).toBe("输入框");
  });

  it("显式绑定 modelValue 的控件用显式路径，而不是 form.<节点ID>", () => {
    const items = collectBindableData(
      page({ children: [inputNode("f1", { modelValue: "{{form.dept}}" })] }),
    );
    const paths = items.map((item) => item.path);
    expect(paths).toContain("form.dept");
    expect(paths).not.toContain("form.f1");
  });

  it("子表单：明细数组本身与组内控件都可绑定（组下标用 0 占位）", () => {
    const items = collectBindableData(
      page({
        children: [
          {
            id: "sf1",
            component: "ec-subform",
            props: { itemPath: "items" },
            children: [inputNode("c1", { label: "商品" })],
          },
        ],
      }),
    );
    const paths = items.map((item) => item.path);
    expect(paths).toContain("form.items");
    expect(paths).toContain("form.items[0].c1");
  });

  it("页面数据源的键可绑定", () => {
    const items = collectBindableData(
      page({
        dataSource: {
          deptList: { type: "http", url: "/api/dept" },
        },
      }),
    );
    const item = items.find((entry) => entry.path === "deptList");
    expect(item?.kind).toBe("datasource");
    expect(item?.hint).toBe("/api/dept");
  });

  it("页面级外部数据源的响应路径可绑定", () => {
    const items = collectBindableData(
      page({
        externalSources: {
          ext1: {
            id: "ext1",
            url: "/api/dept",
            name: "部门",
            responses: [{ scopePath: "external.dept" }],
          },
        },
        children: [{ id: "s1", component: "ec-select", props: {}, externalRef: "ext1" }],
      }),
    );
    const item = items.find((entry) => entry.path === "external.dept");
    expect(item?.kind).toBe("external");
    expect(item?.hint).toBe("部门");
  });

  it("同一路径只出现一次", () => {
    const items = collectBindableData(
      page({
        state: { dept: "技术中心" },
        children: [inputNode("f1", { modelValue: "{{dept}}" })],
      }),
    );
    expect(items.filter((item) => item.path === "dept")).toHaveLength(1);
  });

  it("关键字过滤命中名称与路径", () => {
    const items = collectBindableData(
      page({ state: { user: { name: "张三" } }, children: [inputNode("f1")] }),
    );
    expect(filterBindableData(items, "name").map((i) => i.path)).toContain("user.name");
    expect(filterBindableData(items, "form.f").map((i) => i.path)).toContain("form.f1");
    expect(filterBindableData(items, "")).toHaveLength(items.length);
  });

  it("分组输出保持组内顺序", () => {
    const items = collectBindableData(page({ state: { a: 1 } }));
    const groups = groupBindableData(items);
    expect(groups.map((g) => g.group)).toContain("页面状态");
    expect(groups.find((g) => g.group === "页面状态")?.items[0].path).toBe("a");
  });
});

describe("collectBindableElements：可选元素清单", () => {
  it("标记选项类元素（单选 / 多选 / 下拉）", () => {
    const elements = collectBindableElements(
      page({
        children: [
          { id: "s1", component: "ec-select", props: {} },
          { id: "r1", component: "ec-radio", props: {} },
          { id: "i1", component: "ec-input", props: {} },
        ],
      }),
    );
    expect(elements.find((e) => e.nodeId === "s1")?.isOption).toBe(true);
    expect(elements.find((e) => e.nodeId === "r1")?.isOption).toBe(true);
    expect(elements.find((e) => e.nodeId === "i1")?.isOption).toBe(false);
  });

  it("明细容器标记为整组，可整体作为单个参数值", () => {
    const elements = collectBindableElements(
      page({
        children: [
          {
            id: "sf1",
            component: "ec-subform",
            props: { itemPath: "items" },
            children: [inputNode("c1")],
          },
        ],
      }),
    );
    const group = elements.find((e) => e.nodeId === "sf1");
    expect(group?.isGroup).toBe(true);
    expect(group?.path).toBe("form.items");
    expect(elements.find((e) => e.nodeId === "c1")?.path).toBe("form.items[0].c1");
  });
});

describe("canOwnExternalSource：哪些元素可以拥有外部数据源", () => {
  it("内容可被用户改变的元素（表单控件 / 选项类）可以拥有", () => {
    expect(canOwnExternalSource("ec-input")).toBe(true);
    expect(canOwnExternalSource("ec-textarea")).toBe(true);
    expect(canOwnExternalSource("ec-select")).toBe(true);
    expect(canOwnExternalSource("ec-radio")).toBe(true);
    expect(canOwnExternalSource("ec-checkbox")).toBe(true);
    expect(canOwnExternalSource("ec-dict-select")).toBe(true);
  });

  it("内容不可被用户改变的纯展示元素不能拥有", () => {
    expect(canOwnExternalSource("ec-text")).toBe(false);
    expect(canOwnExternalSource("ec-title")).toBe(false);
    expect(canOwnExternalSource("ec-image")).toBe(false);
    expect(canOwnExternalSource("ec-divider")).toBe(false);
    expect(canOwnExternalSource("ec-container")).toBe(false);
    expect(canOwnExternalSource("ec-table")).toBe(false);
    expect(canOwnExternalSource("ec-button")).toBe(false);
    expect(canOwnExternalSource("ec-subform")).toBe(false);
  });

  it("带不带 ec- 前缀结果一致", () => {
    expect(canOwnExternalSource("input")).toBe(canOwnExternalSource("ec-input"));
    expect(canOwnExternalSource("text")).toBe(canOwnExternalSource("ec-text"));
  });
});
