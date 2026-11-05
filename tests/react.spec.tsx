import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SchemaRenderer } from "@x-ac/design-react";
import type { PageSchema } from "@x-ac/design-core";

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "react-page",
  type: "page",
  meta: { title: "React 渲染" },
  state: { form: { name: "张三", dept: "技术中心" }, list: [{ name: "李四", dept: "产品中心" }] },
  children: [
    {
      id: "r_title",
      component: "title",
      props: { text: "员工登记" },
      style: { margin: "0 0 4px", padding: "8px" },
    },
    {
      id: "r_name",
      component: "input",
      props: { label: "姓名", required: true, modelValue: "{{form.name}}" },
      style: { marginBottom: "12px" },
    },
    {
      id: "r_dept",
      component: "select",
      props: { label: "部门", options: "技术中心,产品中心", modelValue: "{{form.dept}}" },
    },
    {
      id: "r_loop",
      component: "tag",
      props: { text: "{{item.name}}" },
      directives: [{ name: "for", value: "{{list}}", itemKey: "item" }],
    },
    {
      id: "r_hidden",
      component: "text",
      props: { text: "不该出现" },
      directives: [{ name: "show", value: "false" }],
    },
    {
      id: "r_unknown",
      component: "not-exists",
      props: {},
      children: [{ id: "r_child", component: "text", props: { text: "子节点仍渲染" } }],
    },
    {
      id: "r_table",
      component: "table",
      props: { columns: "姓名:name,部门:dept", data: "{{list}}", emptyText: "暂无数据" },
    },
  ],
};

const html = renderToStaticMarkup(<SchemaRenderer page={page} />);

describe("React 适配层", () => {
  it("同一份 Schema 渲染出标题与表达式结果", () => {
    expect(html).toContain("<h3");
    expect(html).toContain("员工登记");
    expect(html).toContain('value="张三"');
    expect(html).not.toContain("{{form.name}}");
  });

  it("通用 margin / padding 落到 style 属性", () => {
    expect(html).toContain("margin:0 0 4px");
    expect(html).toContain("padding:8px");
  });

  it("表单控件套用字段外壳并标记必填", () => {
    expect(html).toContain("ux-field");
    expect(html).toContain("ux-req");
    expect(html).toContain("姓名");
  });

  it("for 指令按数组展开，show 为假的节点被隐藏", () => {
    expect(html).toContain("李四");
    expect(html).toContain("display:none");
  });

  it("未知组件降级占位且保留子节点", () => {
    expect(html).toContain("未知组件 not-exists");
    expect(html).toContain("子节点仍渲染");
  });

  it("表格按列配置渲染数据行", () => {
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("产品中心");
  });
});
