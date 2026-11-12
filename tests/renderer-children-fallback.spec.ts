// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { PageSchema } from "@x-ac/web-design-core";

beforeAll(() => {
  // Element Plus 部分组件依赖 ResizeObserver，jsdom 没有实现
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
});

// 畸形 Schema：完全缺失 children 字段（旧版本迁移残留 / 截断 JSON / 手工构造）
function missingChildrenPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_missing_children",
    type: "page",
    meta: { title: "畸形 Schema", device: "pc" },
    state: {},
  } as PageSchema;
}

// children 显式赋值为 undefined（类型允许以外、运行时可能出现的状态）
function undefinedChildrenPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_undefined_children",
    type: "page",
    meta: { title: "undefined children", device: "pc" },
    state: {},
    children: undefined as unknown as never[],
  };
}

// 正常空 children（对照基线）
function emptyChildrenPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_empty_children",
    type: "page",
    meta: { title: "空 children", device: "pc" },
    state: {},
    children: [],
  };
}

describe.skipIf(!__HAS_ELEMENT_PLUS__)("SchemaRenderer 对缺 children 的畸形 Schema 兜底", () => {
  it("缺 children 字段时不崩溃，渲染空状态", () => {
    const wrapper = mount(SchemaRenderer, {
      props: { page: missingChildrenPage(), mode: "view", design: false },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.find(".wb-renderer__empty").exists()).toBe(true);
    expect(wrapper.find(".wb-renderer__empty-title").text()).toContain("页面暂无内容");
  });

  it("children 为 undefined 时不崩溃，渲染空状态", () => {
    const wrapper = mount(SchemaRenderer, {
      props: { page: undefinedChildrenPage(), mode: "view", design: false },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.find(".wb-renderer__empty").exists()).toBe(true);
  });

  it("正常空 children 与畸形 Schema 行为一致（均显示空状态，而非白屏）", () => {
    const wrapper = mount(SchemaRenderer, {
      props: { page: emptyChildrenPage(), mode: "view", design: false },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.find(".wb-renderer__empty").exists()).toBe(true);
  });
});
