import { describe, expect, it } from "vitest";
import { MATERIALS, createRegistry, registerMaterials, toHtml } from "@x-ac/design-core";
import type { PageSchema } from "@x-ac/design-core";

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "p-html",
  type: "page",
  meta: { title: "导出验证" },
  state: { form: { name: "张三" }, list: [{ name: "李四" }] },
  children: [
    {
      id: "t1",
      component: "title",
      props: { text: "员工登记" },
      style: { padding: "12px", marginBottom: "16px" },
    },
    { id: "t2", component: "text", props: { text: "姓名：{{form.name}}" } },
    {
      id: "f1",
      component: "input",
      props: { label: "姓名", required: true, modelValue: "{{form.name}}" },
    },
    {
      id: "loop",
      component: "tag",
      props: { text: "{{item.name}}" },
      directives: [{ name: "for", value: "{{list}}", itemKey: "item" }],
    },
    {
      id: "hidden",
      component: "text",
      props: { text: "不该出现" },
      directives: [{ name: "show", value: "false" }],
    },
  ],
};

describe("静态 HTML 导出（不依赖 Vue）", () => {
  const html = toHtml(page);

  it("输出完整文档并转义标题", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<title>导出验证</title>");
    expect(html).toContain("lang=\"zh-CN\"");
  });

  it("表达式在导出时按 state 求值", () => {
    expect(html).toContain("姓名：张三");
    expect(html).not.toContain("{{form.name}}");
  });

  it("间距被写成标准 CSS 声明", () => {
    expect(html).toContain("padding:12px");
    expect(html).toContain("margin-bottom:16px");
  });

  it("表单控件导出为原生控件且保留必填", () => {
    expect(html).toContain("<label class=\"ux-field\">");
    expect(html).toContain("required");
  });

  it("for 指令按数组展开，show 为假的节点被隐藏", () => {
    expect(html).toContain("李四");
    expect(html).toContain("display:none");
  });

  it("同样的输入多次导出结果稳定", () => {
    expect(toHtml(page)).toBe(html);
  });
});

/**
 * 静态导出也必须认当前适配包的物料目录（T-034）：
 * 否则设计器里看到的间距、业务物料的占位策略，导出来就变样。
 */
describe("静态 HTML 导出接受物料目录", () => {
  const businessPage: PageSchema = {
    schemaVersion: "1.0.0",
    id: "p-biz",
    type: "page",
    meta: { title: "业务物料导出" },
    state: {},
    children: [
      { id: "b1", component: "biz-risk-badge", props: { text: "风险待评估" } },
      { id: "b2", component: "biz-portable-note", props: { text: "可移植说明" } },
    ],
  };

  const adapter = registerMaterials<string>({ name: "test", components: {}, materials: MATERIALS }, [
    {
      component: "biz-risk-badge",
      title: "风险徽章",
      impl: "span",
      defaultStyle: { letterSpacing: "1px" },
    },
    {
      component: "biz-portable-note",
      title: "可移植说明",
      kind: "display",
      impl: "p",
      portable: true,
      textProp: "text",
      defaultStyle: { fontStyle: "italic" },
    },
  ]);

  const catalog = createRegistry(adapter.materials);
  const html = toHtml(businessPage, { materials: catalog });

  it("业务物料在静态导出里给占位，不拿原生控件冒充", () => {
    expect(html).toContain("风险徽章");
    expect(html).toContain("不可静态导出");
  });

  it("物料 defaultStyle 参与静态导出的样式合并", () => {
    expect(html).toContain("letter-spacing:1px");
    expect(html).toContain("font-style:italic");
  });

  it("不传目录时行为与历史一致：业务物料按未知组件降级", () => {
    const legacy = toHtml(businessPage);
    expect(legacy).toContain("data-component=\"biz-risk-badge\"");
    expect(legacy).not.toContain("不可静态导出");
    expect(legacy).not.toContain("letter-spacing:1px");
  });
});
