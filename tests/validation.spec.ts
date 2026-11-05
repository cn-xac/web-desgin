import { describe, expect, it } from "vitest";
import {
  compilePattern,
  describeField,
  ruleMessage,
  validateData,
  validateFieldValue,
  valueLength,
} from "@x-ac/design-core";
import type { NodeSchema, PageSchema, ValidationRule } from "@x-ac/design-core";

function page(children: NodeSchema[], state: Record<string, unknown> = {}): PageSchema {
  return { schemaVersion: "1.0.0", id: "p_test", type: "page", meta: { title: "校验测试" }, state, children };
}

function node(
  component: string,
  props: Record<string, unknown>,
  rules?: ValidationRule[],
  id = "n_1",
): NodeSchema {
  return { id, component, props, rules };
}

function check(schema: NodeSchema, state: Record<string, unknown>) {
  const field = describeField(schema, state);
  if (!field) throw new Error(`${schema.component} 不是表单控件`);
  return validateFieldValue(field, state);
}

describe("校验规则引擎", () => {
  it("必填：空串 / 空白 / 空数组都算空", () => {
    const input = node("input", { label: "姓名", modelValue: "{{form.name}}" }, [{ type: "required" }]);

    expect(check(input, { form: { name: "" } })?.message).toBe("请填写姓名");
    expect(check(input, { form: { name: "   " } })?.message).toBe("请填写姓名");
    expect(check(input, { form: {} })?.message).toBe("请填写姓名");
    expect(check(input, { form: { name: "王小明" } })).toBeNull();

    const tags = node("checkbox", { label: "标签", modelValue: "{{form.tags}}" }, [{ type: "required" }]);
    expect(check(tags, { form: { tags: [] } })?.message).toBe("请选择标签");
  });

  it("0 与 false 不算空", () => {
    const number = node("number", { label: "数量", modelValue: "{{form.count}}" }, [{ type: "required" }]);
    expect(check(number, { form: { count: 0 } })).toBeNull();
  });

  it("选择类组件的必填文案是「请选择」", () => {
    const select = node("select", { label: "部门", modelValue: "{{form.dept}}" }, [{ type: "required" }]);
    expect(check(select, { form: {} })?.message).toBe("请选择部门");
  });

  it("长度：按字符算，emoji 记 1 个", () => {
    expect(valueLength("👍🏻")).toBe(2); // 肤色修饰符也是独立码点
    expect(valueLength("你好")).toBe(2);
    expect(valueLength([1, 2, 3])).toBe(3);

    const input = node("input", { label: "昵称", modelValue: "{{form.name}}" }, [
      { type: "minLength", value: 2 },
      { type: "maxLength", value: 4 },
    ]);

    expect(check(input, { form: { name: "王" } })?.message).toBe("昵称不能少于 2 个字符");
    expect(check(input, { form: { name: "王小" } })).toBeNull();
    expect(check(input, { form: { name: "王小明啊" } })).toBeNull();
    expect(check(input, { form: { name: "王小明啊哈" } })?.message).toBe("昵称不能超过 4 个字符");
  });

  it("数值范围：min / max 含边界", () => {
    const number = node("number", { label: "年龄", modelValue: "{{form.age}}" }, [
      { type: "min", value: 18 },
      { type: "max", value: 60 },
    ]);

    expect(check(number, { form: { age: 17 } })?.message).toBe("年龄不能小于 18");
    expect(check(number, { form: { age: 18 } })).toBeNull();
    expect(check(number, { form: { age: 60 } })).toBeNull();
    expect(check(number, { form: { age: 61 } })?.message).toBe("年龄不能大于 60");
  });

  it("数值规则对可转数字的字符串同样生效", () => {
    const input = node("input", { label: "数量", modelValue: "{{form.count}}" }, [{ type: "max", value: 5 }]);
    expect(check(input, { form: { count: "9" } })?.message).toBe("数量不能大于 5");
    expect(check(input, { form: { count: "3" } })).toBeNull();
  });

  it("整数规则拦小数", () => {
    const number = node("number", { label: "件数", modelValue: "{{form.qty}}" }, [{ type: "integer" }]);
    expect(check(number, { form: { qty: 1.5 } })?.message).toBe("件数必须是整数");
    expect(check(number, { form: { qty: 2 } })).toBeNull();
  });

  it("自定义正则：源码 + 修饰符，非法正则不误报", () => {
    const code = node("input", { label: "工号", modelValue: "{{form.code}}" }, [
      { type: "pattern", value: "^[A-Z]{2}\\d{4}$" },
    ]);

    expect(check(code, { form: { code: "ab1234" } })?.message).toBe("工号格式不正确");
    expect(check(code, { form: { code: "AB1234" } })).toBeNull();

    const insensitive = node("input", { label: "工号", modelValue: "{{form.code}}" }, [
      { type: "pattern", value: "^[a-z]{2}\\d{4}$", flags: "i" },
    ]);
    expect(check(insensitive, { form: { code: "AB1234" } })).toBeNull();

    // 非法正则属于 Schema 配置问题，不应让用户输入背锅
    const broken = node("input", { label: "工号", modelValue: "{{form.code}}" }, [
      { type: "pattern", value: "([a-z" },
    ]);
    expect(check(broken, { form: { code: "whatever" } })).toBeNull();
    expect(compilePattern("([a-z")).toBeNull();
  });

  it("邮箱 / 手机号内置规则", () => {
    const email = node("input", { label: "邮箱", modelValue: "{{form.email}}" }, [{ type: "email" }]);
    expect(check(email, { form: { email: "a@b" } })?.message).toBe("邮箱不是合法的邮箱地址");
    expect(check(email, { form: { email: "a@b.com" } })).toBeNull();

    const phone = node("input", { label: "手机号", modelValue: "{{form.mobile}}" }, [{ type: "phone" }]);
    expect(check(phone, { form: { mobile: "12345678901" } })?.message).toBe("手机号不是合法的手机号");
    expect(check(phone, { form: { mobile: "13800138000" } })).toBeNull();
  });

  it("非必填字段为空时跳过格式规则", () => {
    const input = node("input", { label: "邮箱", modelValue: "{{form.email}}" }, [
      { type: "email" },
      { type: "minLength", value: 6 },
    ]);
    expect(check(input, { form: { email: "" } })).toBeNull();
  });

  it("when 条件为假时整条规则跳过", () => {
    const input = node("input", { label: "公司名称", modelValue: "{{form.company}}" }, [
      { type: "required", when: "form.type === 'company'" },
    ]);

    expect(check(input, { form: { type: "person" } })).toBeNull();
    expect(check(input, { form: { type: "company" } })?.message).toBe("请填写公司名称");
  });

  it("自定义文案支持 {label} / {value} 占位", () => {
    const input = node("input", { label: "备注", modelValue: "{{form.note}}" }, [
      { type: "maxLength", value: 10, message: "{label}最多 {value} 个字" },
    ]);
    expect(check(input, { form: { note: "一二三四五六七八九十十一" } })?.message).toBe("备注最多 10 个字");
  });

  it("同一字段只报第一条不通过的规则", () => {
    const input = node("input", { label: "姓名", modelValue: "{{form.name}}" }, [
      { type: "required" },
      { type: "minLength", value: 2 },
    ]);
    const field = describeField(input, { form: { name: "" } })!;
    expect(validateFieldValue(field, { form: { name: "" } })?.rule).toBe("required");
    expect(validateFieldValue(field, { form: { name: "王" } })?.rule).toBe("minLength");
  });

  it("兼容老 Schema 的 props.required", () => {
    const legacy = node("input", { label: "姓名", required: true, modelValue: "{{form.name}}" });
    expect(check(legacy, { form: {} })?.message).toBe("请填写姓名");

    // 显式规则优先，不会因为 legacy 重复出一条 required
    const both = node("input", { label: "姓名", required: true, modelValue: "{{form.name}}" }, [
      { type: "maxLength", value: 3 },
    ]);
    expect(describeField(both, {})!.rules.map((rule) => rule.type)).toEqual(["required", "maxLength"]);
  });

  it("非表单组件不参与数据校验", () => {
    expect(describeField(node("text", { text: "说明" }), {})).toBeNull();
  });

  it("默认文案可单独取用（设计器预览同源）", () => {
    expect(ruleMessage({ type: "required" }, "姓名", "input")).toBe("请填写姓名");
    expect(ruleMessage({ type: "maxLength", value: 8 }, "备注", "textarea")).toBe("备注不能超过 8 个字符");
  });
});

describe("整页校验", () => {
  const schema = page(
    [
      node("input", { label: "姓名", modelValue: "{{form.name}}" }, [{ type: "required" }], "n_name"),
      node("input", { label: "手机号", modelValue: "{{form.mobile}}" }, [{ type: "phone" }], "n_mobile"),
      node("text", { text: "与校验无关" }),
    ],
    { form: { name: "", mobile: "123" } },
  );

  it("汇总所有不通过的字段", () => {
    const result = validateData(schema, schema.state!);
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.nodeId)).toEqual(["n_name", "n_mobile"]);
    expect(result.checkedFields).toBe(2);
    expect(result.checkedRules).toBe(2);
    expect(result.byNode.n_name).toBe("请填写姓名");
  });

  it("写入 errors 时清理上一轮的旧键", () => {
    const errors: Record<string, string> = { n_mobile: "旧错误", n_ghost: "已删除的节点" };
    const result = validateData(schema, { form: { name: "王小明", mobile: "13800138000" } }, { errors });

    expect(result.valid).toBe(true);
    expect(errors).toEqual({});
  });

  it("全通过时 valid 为 true", () => {
    const result = validateData(schema, { form: { name: "王小明", mobile: "13800138000" } });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
