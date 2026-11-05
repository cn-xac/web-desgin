import { describe, expect, it } from "vitest";
import { toHtml } from "@x-ac/design-core";
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
