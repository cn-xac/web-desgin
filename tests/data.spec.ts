import { describe, expect, it } from "vitest";
import { describeExport, exportData, toDataJSON } from "@x-ac/design-core";
import type { NodeSchema, PageSchema, ValidationRule } from "@x-ac/design-core";

function page(children: NodeSchema[], state: Record<string, unknown> = {}): PageSchema {
  return { schemaVersion: "1.0.0", id: "p_data", type: "page", meta: { title: "数据导出" }, state, children };
}

function field(
  id: string,
  label: string,
  path: string,
  rules?: ValidationRule[],
  component = "input",
): NodeSchema {
  return { id, component, props: { label, modelValue: `{{${path}}}` }, rules };
}

const schema = page(
  [
    field("n_name", "姓名", "form.name", [{ type: "required" }]),
    field("n_mobile", "手机号", "form.mobile", [{ type: "phone" }]),
    field("n_note", "备注", "form.note"),
    field("n_amount", "金额", "form.amount", [], "amount-input"),
    { id: "n_free", component: "input", props: { label: "未绑定字段" } },
    { id: "n_text", component: "text", props: { text: "说明文字" } },
  ],
  { form: { name: "王小明", mobile: "13800138000", note: "", amount: 0 } },
);

describe("表单数据导出", () => {
  it("按绑定路径还原嵌套对象与扁平视图", () => {
    const result = exportData(schema, schema.state!);

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      form: { name: "王小明", mobile: "13800138000", amount: 0 },
    });
    expect(result.flat).toEqual({
      "form.name": "王小明",
      "form.mobile": "13800138000",
      "form.note": "",
      "form.amount": 0,
    });
  });

  it("默认不导出空值，includeEmpty 可保留", () => {
    expect(exportData(schema, schema.state!).data.form).not.toHaveProperty("note");

    const withEmpty = exportData(schema, schema.state!, { includeEmpty: true });
    expect(withEmpty.data.form).toHaveProperty("note", "");
  });

  it("表单控件未写 modelValue 时按 form.<id> 自动绑定，不再视为未绑定", () => {
    const result = exportData(schema, schema.state!);
    // n_free 是 input 但未写 modelValue，按 form.n_free 自动绑定，故不在 unbound 列表
    expect(result.unbound).toEqual([]);
    // 非表单组件（text）不进入导出范围；自动绑定的 n_free 一并被收集
    expect(result.fields.map((item) => item.nodeId)).toEqual([
      "n_name",
      "n_mobile",
      "n_note",
      "n_amount",
      "n_free",
    ]);
  });

  it("导出时默认顺带校验，validate:false 可跳过", () => {
    const invalid = exportData(schema, { form: { name: "", mobile: "123" } });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.map((item) => item.label)).toEqual(["姓名", "手机号"]);
    // 数据本身照常导出，方便「先存草稿再校验」的场景
    expect(invalid.flat["form.name"]).toBe("");

    const skipped = exportData(schema, { form: { name: "", mobile: "123" } }, { validate: false });
    expect(skipped.valid).toBe(true);
    expect(skipped.errors).toHaveLength(0);
  });

  it("toDataJSON 默认只输出数据，includeMeta 带上校验结果", () => {
    const result = exportData(schema, schema.state!, { validate: false });

    expect(JSON.parse(toDataJSON(result))).toEqual(result.data);

    const withMeta = JSON.parse(toDataJSON(result, { includeMeta: true }));
    expect(withMeta.valid).toBe(true);
    expect(withMeta.data.form.name).toBe("王小明");
    expect(withMeta.exportedAt).toBe(result.exportedAt);
  });

  it("导出结果是深拷贝，改动不会回写页面状态", () => {
    const state = { form: { tags: ["a"] } };
    const listPage = page([field("n_tags", "标签", "form.tags", [], "checkbox")], state);

    const result = exportData(listPage, state, { validate: false });
    (result.data.form as Record<string, unknown>).tags = ["changed"];

    expect(state.form.tags).toEqual(["a"]);
  });

  it("摘要文案区分通过与未通过", () => {
    expect(describeExport(exportData(schema, schema.state!))).toContain("校验通过");
    expect(describeExport(exportData(schema, { form: {} }))).toContain("未通过校验");
  });
});
