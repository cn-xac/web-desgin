import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compactNode, compactPage } from "@x-ac/web-design-core";
import type { PageSchema } from "@x-ac/web-design-core";
import { migratePage } from "@x-ac/web-design-core";

const samplePath = new URL("./fixtures/sample-employee.json", import.meta.url);

describe("序列化与往返一致性", () => {
  it("与物料默认值相同的属性不落库", () => {
    const node = compactNode({
      id: "n1",
      component: "input",
      props: { label: "姓名", placeholder: "请输入", required: false, clearable: true, disabled: false },
    });
    expect(node.props).toEqual({ label: "姓名" });
  });

  it("空 props / style / children 不落库", () => {
    const node = compactNode({ id: "n1", component: "divider", props: {}, style: {}, children: [] });
    expect(node).toEqual({ id: "n1", component: "divider" });
  });

  it("表达式绑定原样保留", () => {
    const node = compactNode({
      id: "n1",
      component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
    });
    expect(node.props?.modelValue).toBe("{{form.name}}");
  });

  it("示例 Schema 往返 diff 为空", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf-8")) as PageSchema;
    const once = compactPage(raw);
    const twice = compactPage(JSON.parse(JSON.stringify(once)) as PageSchema);
    expect(twice).toEqual(once);
  });

  it("示例 Schema 结构完整（节点数不变）", () => {
    const raw = JSON.parse(readFileSync(samplePath, "utf-8")) as PageSchema;
    const compact = compactPage(raw);
    const count = (nodes: typeof compact.children): number =>
      nodes.reduce((sum, node) => sum + 1 + (node.children ? count(node.children) : 0), 0);
    expect(count(compact.children)).toBe(count(raw.children));
  });
});

describe("版本迁移", () => {
  it("同版本原样返回", () => {
    const { schema, applied } = migratePage({ schemaVersion: "1.0.0", id: "p", type: "page", children: [] });
    expect(applied).toEqual([]);
    expect(schema.schemaVersion).toBe("1.0.0");
  });

  it("更高版本直接拒绝", () => {
    expect(() => migratePage({ schemaVersion: "9.9.9", id: "p", type: "page", children: [] })).toThrow(/高于/);
  });

  it("缺少迁移函数时给出可读错误", () => {
    expect(() => migratePage({ schemaVersion: "0.1.0", id: "p", type: "page", children: [] })).toThrow(/迁移/);
  });

  it("损坏 JSON 文本报错而不是白屏", () => {
    expect(() => migratePage("{ not json")).toThrow(/JSON/);
  });

  it("缺失 meta / children 时补默认结构", () => {
    const { schema } = migratePage({ schemaVersion: "1.0.0", id: "p", type: "page" });
    expect(schema.meta?.title).toBe("未命名页面");
    expect(schema.children).toEqual([]);
  });
});
