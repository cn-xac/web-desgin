import { describe, expect, it } from "vitest";
import {
  evaluate,
  extractPath,
  getByPath,
  resolveBoolean,
  resolveValue,
  setByPath,
} from "@x-ac/web-design-core";

const scope = {
  form: { name: "张三", age: 28, dept: "", skills: ["Vue", "TS"] },
  list: [{ id: 1 }, { id: 2 }],
  count: 3,
};

describe("受限表达式求值", () => {
  it("读取普通路径", () => {
    expect(evaluate("form.name", scope)).toBe("张三");
    expect(evaluate("form.age", scope)).toBe(28);
  });

  it("读取数组下标与 length", () => {
    expect(evaluate("list[0].id", scope)).toBe(1);
    expect(evaluate("list.length", scope)).toBe(2);
    expect(evaluate("form.skills[1]", scope)).toBe("TS");
  });

  it("支持算术、比较、逻辑与三元", () => {
    expect(evaluate("form.age + 2", scope)).toBe(30);
    expect(evaluate("count > 2 && count < 5", scope)).toBe(true);
    expect(evaluate("form.dept === ''", scope)).toBe(true);
    expect(evaluate("count > 2 ? '多' : '少'", scope)).toBe("多");
  });

  it("非法表达式返回 undefined 而不是抛错", () => {
    expect(evaluate("form.", scope)).toBeUndefined();
    expect(evaluate("alert(1)", scope)).toBeUndefined();
    expect(evaluate("a + ", scope)).toBeUndefined();
    expect(evaluate("", scope)).toBeUndefined();
  });

  it("阻止原型链与全局对象逃逸", () => {
    expect(evaluate("window.location", scope)).toBeUndefined();
    expect(evaluate("globalThis", scope)).toBeUndefined();
    expect(evaluate("constructor", scope)).toBeUndefined();
    expect(evaluate("form.__proto__", scope)).toBeUndefined();
    expect(evaluate("form['constructor']", scope)).toBeUndefined();
    expect(evaluate("list.map", scope)).toBeUndefined();
  });

  it("整串插值保留原始类型", () => {
    expect(resolveValue("{{list}}", scope)).toEqual(scope.list);
    expect(resolveValue("{{form.age}}", scope)).toBe(28);
    expect(resolveValue("{{count > 2}}", scope)).toBe(true);
  });

  it("混排插值转成字符串，undefined 变空串", () => {
    expect(resolveValue("你好，{{form.name}}", scope)).toBe("你好，张三");
    expect(resolveValue("共 {{list.length}} 条", scope)).toBe("共 2 条");
    expect(resolveValue("{{notExist}}", scope)).toBeUndefined();
    expect(resolveValue("前缀{{notExist}}", scope)).toBe("前缀");
  });

  it("首尾都是插值的混排也能逐段替换（自由拼接）", () => {
    // "{{a}}/{{b}}" 会被整串插值正则误当成单个表达式，这里守住逐段替换的行为
    expect(resolveValue("{{form.name}}/{{form.age}}", scope)).toBe("张三/28");
    expect(resolveValue("{{a}}-{{b}}-{{c}}", { a: 1, b: 2, c: 3 })).toBe("1-2-3");
    expect(resolveValue("{{form.name}}/{{notExist}}", scope)).toBe("张三/");
  });

  it("非字符串原样返回", () => {
    const arr = [{ label: "姓名", prop: "name" }];
    expect(resolveValue(arr, scope)).toBe(arr);
    expect(resolveValue(12, scope)).toBe(12);
  });

  it("指令布尔值支持裸表达式", () => {
    expect(resolveBoolean("list.length > 0", scope)).toBe(true);
    expect(resolveBoolean("list.length === 0", scope)).toBe(false);
    expect(resolveBoolean("{{form.dept}}", scope)).toBe(false);
  });
});

describe("路径读写", () => {
  it("getByPath 支持深层路径", () => {
    expect(getByPath(scope, "form.name")).toBe("张三");
    expect(getByPath(scope, "form.notExist")).toBeUndefined();
  });

  it("setByPath 写回并自动补全中间对象", () => {
    const target: Record<string, unknown> = { form: { name: "" } };
    setByPath(target, "form.name", "李四");
    expect((target.form as Record<string, unknown>).name).toBe("李四");
    setByPath(target, "extra.deep.value", 1);
    expect(getByPath(target, "extra.deep.value")).toBe(1);
  });

  it("setByPath 拒绝危险键", () => {
    const target: Record<string, unknown> = {};
    expect(setByPath(target, "__proto__.polluted", true)).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("extractPath 只认纯路径绑定", () => {
    expect(extractPath("{{form.name}}")).toBe("form.name");
    expect(extractPath("{{ list[0].id }}")).toBe("list[0].id");
    expect(extractPath("姓名：{{form.name}}")).toBeNull();
    expect(extractPath("form.name")).toBeNull();
    expect(extractPath("{{form.name || 'x'}}")).toBeNull();
  });
});
