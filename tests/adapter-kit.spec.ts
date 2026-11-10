/**
 * 适配层 SDK 回归用例。
 *
 * 本轮把「框架无关工具」下沉 core、把「组件作者 SDK」上提到 design-vue/kit 与
 * design-react/kit，这里锁住三层的边界：
 *   - core 只做纯函数与协议，不认识框架；
 *   - vue / react kit 各自给默认绑定通道与类型收窄；
 *   - kit 必须是无副作用的纯 JS（不加载渲染器 / CSS / Context）。
 */
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import {
  DEFAULT_BINDING,
  MATERIALS,
  bindModel,
  defineAdapter,
  inspectAdapter,
  parseLabels,
  parseList,
  parsePairs,
  parsePaths,
  prefixedComponents,
} from "@x-ac/web-design-core";
import { VUE_BINDING, createDesignerKit, defineVueAdapter, useFieldModel } from "@x-ac/web-design-vue/kit";
import { REACT_BINDING, defineReactAdapter } from "@x-ac/web-design-react/kit";

describe("core：上移的通用解析工具", () => {
  it("parsePairs 支持中英文分隔符与首个冒号切分", () => {
    expect(parsePairs("标题:内容, 只有标签; 链接:https://x.com/a:b")).toEqual([
      { label: "标题", value: "内容" },
      { label: "只有标签", value: "" },
      { label: "链接", value: "https://x.com/a:b" },
    ]);
  });

  it("parseLabels / parseList 等价，且支持数组入参", () => {
    expect(parseLabels("甲，乙; 丙")).toEqual(["甲", "乙", "丙"]);
    expect(parseList(["a", "b"])).toEqual(["a", "b"]);
    expect(parseLabels(null)).toEqual([]);
  });

  it("parsePaths 合并重复的中间节点并裁掉空 children", () => {
    const tree = parsePaths("华东/上海/浦东\n华东/上海/徐汇\n华南/广州");
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].children).toHaveLength(2);
    expect(tree[1].children?.[0].children).toBeUndefined();
  });
});

describe("core：通用组装工具", () => {
  it("prefixedComponents 加 ec- 前缀且幂等", () => {
    expect(prefixedComponents({ input: "I", "ec-select": "S" })).toEqual({
      "ec-input": "I",
      "ec-select": "S",
    });
  });

  it("bindModel 按通道翻译成目标库属性", () => {
    const onChange = (): void => undefined;
    expect(bindModel(REACT_BINDING, 7, onChange)).toEqual({ value: 7, onChange });
    expect(bindModel(DEFAULT_BINDING, "x", onChange)).toEqual({
      modelValue: "x",
      "onUpdate:modelValue": onChange,
    });
  });

  it("defineAdapter 补默认通道，可选字段不写进对象", () => {
    const adapter = defineAdapter({ name: "bare", components: {}, materials: [] });
    expect(adapter.binding).toEqual(DEFAULT_BINDING);
    expect("actions" in adapter).toBe(false);
    expect("designer" in adapter).toBe(false);
  });

  it("inspectAdapter 只报告不抛错，缺实现时 ok=false", () => {
    expect(inspectAdapter(defineAdapter({ name: "empty", components: {}, materials: [] })).ok).toBe(true);
    const partial = defineAdapter({ name: "partial", components: {}, materials: MATERIALS });
    const report = inspectAdapter(partial);
    expect(report.ok).toBe(false);
    expect(report.missing.length).toBeGreaterThan(0);
    expect(report.slots).toEqual([]);
  });
});

describe("design-vue/kit：Vue 扩展仓适配层", () => {
  it("defineVueAdapter 默认走 modelValue 通道，可被覆盖", () => {
    expect(defineVueAdapter({ name: "v", components: {}, materials: [] }).binding).toEqual(VUE_BINDING);
    expect(VUE_BINDING).toEqual(DEFAULT_BINDING);
    const custom = defineVueAdapter({
      name: "v",
      components: {},
      materials: [],
      binding: { prop: "value", event: "onUpdate:value" },
    });
    expect(custom.binding).toEqual({ prop: "value", event: "onUpdate:value" });
  });

  it("createDesignerKit 过滤未实现槽位，保留 notify", () => {
    const Button = (): null => null;
    const notify = (): void => undefined;
    const kit = createDesignerKit({ Button, Input: undefined, notify });
    expect(kit.Button).toBe(Button);
    expect("Input" in kit).toBe(false);
    expect(kit.notify).toBe(notify);
  });

  it("useFieldModel 读值响应式，回写同时转发 change", () => {
    const source = ref<unknown>("a");
    const updates: unknown[] = [];
    const changes: unknown[] = [];
    const { model, onUpdate } = useFieldModel(
      () => source.value,
      (value) => updates.push(value),
      (value) => changes.push(value),
    );

    expect(model.value).toBe("a");
    onUpdate("b");
    expect(updates).toEqual(["b"]);
    expect(changes).toEqual(["b"]);
    source.value = "c";
    expect(model.value).toBe("c");
  });
});

describe("design-react/kit：React 扩展仓适配层", () => {
  it("defineReactAdapter 默认走 value/onChange，与 Vue 通道不同拼写", () => {
    const adapter = defineReactAdapter({ name: "r", components: {}, materials: [] });
    expect(adapter.binding).toEqual({ prop: "value", event: "onChange" });
    expect(REACT_BINDING).not.toEqual(VUE_BINDING);
  });
});
