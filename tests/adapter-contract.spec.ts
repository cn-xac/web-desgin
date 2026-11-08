// @vitest-environment jsdom
/**
 * UiAdapter 两个协议字段在 Vue 引擎里的真实消费：
 * provider（外层上下文包装）与 propAliases（属性名映射）。
 *
 * 这两个字段原先只在 core 里有类型定义、defineAdapter 里透传，引擎从未读取；
 * 本用例锁住「声明即生效」与「未配置时零副作用」两条边界。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { Component } from "vue";
import { SchemaRenderer } from "@x-ac/design-vue";
import { MATERIALS } from "@x-ac/design-core";
import type { PageSchema, UiAdapter } from "@x-ac/design-core";

/** 只声明驼峰属性，用来观察 Schema 里的通用名有没有被别名改写 */
const AliasInput = defineComponent({
  name: "AliasInput",
  props: { maxLength: { type: [Number, String], default: undefined } },
  setup(props) {
    return () => h("input", { class: "alias-input", "data-maxlength": String(props.maxLength ?? "") });
  },
});

/** 模拟 NConfigProvider / a-config-provider 这类外层上下文组件 */
const ThemeProvider = defineComponent({
  name: "ThemeProvider",
  setup(_props, { slots }) {
    return () => h("div", { class: "theme-provider", "data-theme": "dark" }, slots.default?.());
  },
});

function makePage(props: Record<string, unknown> = {}): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_adapter_contract",
    type: "page",
    meta: { title: "适配包契约", device: "pc" },
    state: {},
    children: [{ id: "n_input", component: "ec-input", props }],
  };
}

function adapter(overrides: Partial<UiAdapter<Component>> = {}): UiAdapter<Component> {
  return { name: "contract-test", components: { "ec-input": AliasInput }, materials: MATERIALS, ...overrides };
}

describe("UiAdapter.provider", () => {
  it("配置后由 provider 包住整棵渲染树", () => {
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage(), adapter: adapter({ provider: ThemeProvider }) },
    });
    expect(wrapper.find(".theme-provider").exists()).toBe(true);
    expect(wrapper.find(".theme-provider").attributes("data-theme")).toBe("dark");
    expect(wrapper.find(".theme-provider > .wb-renderer").exists()).toBe(true);
    expect(wrapper.find(".alias-input").exists()).toBe(true);
  });

  it("未配置时不产生额外 DOM，根节点仍是 div.wb-renderer", () => {
    const wrapper = mount(SchemaRenderer, { props: { page: makePage(), adapter: adapter() } });
    expect(wrapper.find(".wb-renderer").exists()).toBe(true);
    expect(wrapper.find(".theme-provider").exists()).toBe(false);
    expect(wrapper.find(".wb-renderer").element.parentElement?.className ?? "").not.toContain("provider");
  });
});

describe("UiAdapter.propAliases", () => {
  it("Schema 通用名按别名映射成 UI 库的真实属性名", () => {
    const wrapper = mount(SchemaRenderer, {
      props: {
        page: makePage({ maxlength: 6 }),
        adapter: adapter({ propAliases: { maxlength: "maxLength" } }),
      },
    });
    expect(wrapper.find(".alias-input").attributes("data-maxlength")).toBe("6");
  });

  it("未配置别名时原名透传，驼峰 prop 收不到值", () => {
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage({ maxlength: 6 }), adapter: adapter() },
    });
    const input = wrapper.find(".alias-input");
    // Vue 会把未声明的 maxlength 当 attr 落到根 DOM 上
    expect(input.attributes("maxlength")).toBe("6");
    expect(input.attributes("data-maxlength")).toBe("");
  });
});
