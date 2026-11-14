import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  cloneWithNewIds,
  compactNode,
  evaluateConditionGroup,
  evaluateConditionRow,
  resolveLoopInstances,
  resolveVisibility,
  validateAdvancedExpression,
  validatePage,
  type ConditionGroup,
  type NodeSchema,
  type PageSchema,
  type VisibilityConfig,
} from "@x-ac/web-design-core";

const scope = {
  form: {
    type: "company",
    name: "张三丰",
    amount: 12,
    orders: [{ qty: 1 }, { qty: 2 }, { qty: 3 }],
  },
};

const group = (rows: ConditionGroup["rows"], mode: ConditionGroup["mode"] = "and", expression?: string): ConditionGroup => ({
  mode,
  rows,
  ...(expression ? { expression } : {}),
});

const nodeWith = (visibility?: VisibilityConfig, directives?: NodeSchema["directives"]): NodeSchema => ({
  id: "n1",
  component: "ec-input",
  ...(visibility ? { visibility } : {}),
  ...(directives ? { directives } : {}),
});

const hit = group([{ left: "form.type", operator: "eq", value: "company" }]);
const miss = group([{ left: "form.type", operator: "eq", value: "person" }]);

describe("显隐优先级（r5u4Ul）", () => {
  it("显示高于隐藏：show 与 hide 同时命中时显示", () => {
    const decision = resolveVisibility(nodeWith({ show: hit, hide: hit }), scope);
    expect(decision).toMatchObject({ visible: true, source: "local-show" });
  });

  it("仅 hide 命中时隐藏，隐藏方式为 display:none", () => {
    const decision = resolveVisibility(nodeWith({ hide: hit }), scope);
    expect(decision).toMatchObject({ visible: false, source: "local-hide", mode: "show" });
  });

  it("外部 force 忽略本地 show 条件", () => {
    const decision = resolveVisibility(nodeWith({ show: hit }), scope, { n1: { visible: false, force: true } });
    expect(decision).toMatchObject({ visible: false, source: "external-force" });
  });

  it("外部非强制时本地条件优先", () => {
    const decision = resolveVisibility(nodeWith({ hide: hit }), scope, { n1: { visible: true } });
    expect(decision).toMatchObject({ visible: false, source: "local-hide" });
  });

  it("外部非强制在本地条件均未命中时生效", () => {
    const decision = resolveVisibility(nodeWith({ hide: miss }), scope, { n1: { visible: false } });
    expect(decision).toMatchObject({ visible: false, source: "external" });
  });

  it("未配置 visibility 时回落旧 directives（if 不渲染 / show 隐藏）", () => {
    expect(resolveVisibility(nodeWith(undefined, [{ name: "if", value: "form.type === 'person'" }]), scope)).toMatchObject({
      visible: false,
      source: "directive",
      mode: "if",
    });
    expect(resolveVisibility(nodeWith(undefined, [{ name: "show", value: "form.amount > 100" }]), scope)).toMatchObject({
      visible: false,
      source: "directive",
      mode: "show",
    });
  });

  it("无任何配置时默认显示", () => {
    expect(resolveVisibility(nodeWith(), scope)).toEqual({ visible: true, source: "default" });
  });
});

describe("多条件组件求值（rfD7Jv）", () => {
  it("并且 / 或者组合", () => {
    const rows = [
      { left: "form.amount", operator: "gt" as const, value: 10 },
      { left: "form.name", operator: "contains" as const, value: "三" },
    ];
    expect(evaluateConditionGroup(group(rows, "and"), scope)).toBe(true);
    expect(evaluateConditionGroup(group([rows[0], { left: "form.type", operator: "eq", value: "x" }], "and"), scope)).toBe(false);
    expect(evaluateConditionGroup(group([rows[0], { left: "form.type", operator: "eq", value: "x" }], "or"), scope)).toBe(true);
  });

  it("高级表达式 1 and (2 or 3) 按序号嵌套求值", () => {
    const rows = [
      { value: true },
      { value: false },
      { value: true },
    ];
    expect(evaluateConditionGroup(group(rows, "advanced", "1 and (2 or 3)"), scope)).toBe(true);
    expect(evaluateConditionGroup(group(rows, "advanced", "1 and (2 and 3)"), scope)).toBe(false);
    expect(evaluateConditionGroup(group(rows, "advanced", "not 2 or 3"), scope)).toBe(true);
  });

  it("高级表达式静态校验拒绝越界序号与不配对括号", () => {
    expect(validateAdvancedExpression("1 and (2 or 3)", 3)).toBeNull();
    expect(validateAdvancedExpression("1 and (4 or 3)", 3)).toMatch(/序号/);
    expect(validateAdvancedExpression("1 and (2", 3)).toMatch(/括号/);
    expect(validateAdvancedExpression("alert(1)", 3)).toMatch(/只能包含/);
  });

  it("仅值形态：无左元素、无关系，直接按布尔表达式求值", () => {
    expect(evaluateConditionRow({ value: "{{form.amount}} > 10" }, scope)).toBe(true);
    expect(evaluateConditionRow({ value: false }, scope)).toBe(false);
    expect(evaluateConditionGroup(group([{ value: true }, { value: true }], "and"), scope)).toBe(true);
  });

  it("字符串关系：包含 / 不包含 / 等于 / 不等于 / 开头 / 结尾", () => {
    expect(evaluateConditionRow({ left: "form.name", operator: "contains", value: "三" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.name", operator: "notContains", value: "李" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.type", operator: "eq", value: "company" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.type", operator: "ne", value: "company" }, scope)).toBe(false);
    expect(evaluateConditionRow({ left: "form.name", operator: "startsWith", value: "张" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.name", operator: "endsWith", value: "丰" }, scope)).toBe(true);
  });

  it("一元关系：为空 / 不为空 / 为真 / 为假", () => {
    expect(evaluateConditionRow({ left: "form.none", operator: "empty" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.name", operator: "notEmpty" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.amount", operator: "truthy" }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: "form.none", operator: "falsy" }, scope)).toBe(true);
  });
});

describe("子表单明细字段：聚合与当前行", () => {
  const path = "form.orders[0].qty";

  it("默认求和，另支持平均 / 最小 / 最大（rtHicl 同一契约）", () => {
    expect(evaluateConditionRow({ left: path, aggregate: "sum", operator: "eq", value: 6 }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: path, aggregate: "avg", operator: "eq", value: 2 }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: path, aggregate: "min", operator: "eq", value: 1 }, scope)).toBe(true);
    expect(evaluateConditionRow({ left: path, aggregate: "max", operator: "eq", value: 3 }, scope)).toBe(true);
  });

  it("未指定聚合时按当前行下标取值", () => {
    expect(evaluateConditionRow({ left: path, operator: "eq", value: 2 }, scope, { rowIndex: 1 })).toBe(true);
    expect(evaluateConditionRow({ left: path, operator: "eq", value: 1 }, scope)).toBe(true);
  });

  it("字符串明细序列的包含运算", () => {
    const names = { form: { orders: [{ tag: "华东" }, { tag: "华南" }] } };
    expect(evaluateConditionRow({ left: "form.orders[0].tag", aggregate: "sum", operator: "contains", value: "华南" }, names)).toBe(true);
  });
});

describe("for 指令统一展开", () => {
  it("裸表达式与 {{}} 写法等价展开，并注入 item / index", () => {
    const node = nodeWith(undefined, [{ name: "for", value: "list" }]);
    const bare = resolveLoopInstances(node, { list: [10, 20] });
    expect(bare).toHaveLength(2);
    expect(bare?.[1].scope.item).toBe(20);
    expect(bare?.[1].scope.index).toBe(1);

    const wrapped = resolveLoopInstances(nodeWith(undefined, [{ name: "for", value: "{{list}}" }]), { list: [10, 20] });
    expect(wrapped?.map((instance) => instance.scope.item)).toEqual([10, 20]);
  });
});

describe("Schema 契约与往返", () => {
  const config: VisibilityConfig = { show: hit, hide: miss };
  const page: PageSchema = {
    schemaVersion: SCHEMA_VERSION,
    id: "p",
    type: "page",
    meta: { title: "显隐测试" },
    children: [nodeWith(config)],
  };

  it("合法 visibility 通过校验", () => {
    expect(validatePage(page).valid).toBe(true);
  });

  it("非法关系 / 半成品条件 / 越界高级表达式会被阻断", () => {
    const illegal = (visibility: unknown): boolean =>
      validatePage({ ...page, children: [{ id: "n1", component: "ec-input", visibility }] } as PageSchema).valid;
    expect(illegal({ show: { mode: "and", rows: [{ left: "form.a", operator: "wat" }] } })).toBe(false);
    expect(illegal({ show: { mode: "and", rows: [{ left: "form.a" }] } })).toBe(false);
    expect(illegal({ show: { mode: "advanced", rows: [{ value: true }], expression: "1 and 3" } })).toBe(false);
  });

  it("序列化与复制粘贴保留 visibility", () => {
    expect(compactNode(page.children[0]).visibility).toEqual(config);
    const cloned = cloneWithNewIds(page.children[0]);
    expect(cloned.visibility).toEqual(config);
    expect(cloned.visibility).not.toBe(page.children[0].visibility);
  });
});
