// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import type { NodeSchema, PageSchema } from "@x-ac/web-design-core";

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

function page(children: NodeSchema[], state: Record<string, unknown> = {}): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_test",
    type: "page",
    meta: { title: "渲染测试", device: "pc" },
    state,
    children,
  };
}

function mountRenderer(schema: PageSchema, mode: "view" | "edit" = "view") {
  return mount(SchemaRenderer, {
    props: { page: schema, mode, design: mode === "edit" },
    global: { plugins: [ElementPlus] },
  });
}

const nameInput: NodeSchema = {
  id: "n_name",
  component: "input",
  props: { label: "姓名", placeholder: "请输入姓名", required: true, modelValue: "{{form.name}}" },
};

const submitButton: NodeSchema = {
  id: "n_submit",
  component: "button",
  props: { text: "提交", type: "primary" },
  events: { click: [{ action: "submitForm", args: { from: "form", to: "list" } }] },
};

const countText: NodeSchema = {
  id: "n_count",
  component: "text",
  props: { text: "共 {{list.length}} 条" },
};

describe.skipIf(!__HAS_ELEMENT_PLUS__)("渲染器集成", () => {
  it("渲染真实 Element Plus 控件与字段外壳", () => {
    const wrapper = mountRenderer(page([nameInput], { form: { name: "" }, list: [] }));
    expect(wrapper.find("input").exists()).toBe(true);
    expect(wrapper.text()).toContain("姓名");
    expect(wrapper.find(".wb-field__req").exists()).toBe(true);
  });

  it("必填校验拦截 → 填写后提交进入列表", async () => {
    const wrapper = mountRenderer(page([nameInput, submitButton, countText], { form: { name: "" }, list: [] }));
    const button = wrapper.findAll("button").find((b) => b.text().includes("提交"));
    expect(button).toBeTruthy();

    await button!.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.find(".wb-field__error").exists()).toBe(true);
    expect(wrapper.text()).toContain("共 0 条");

    await wrapper.find("input").setValue("王小明");
    await button!.trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.text()).toContain("共 1 条");
    expect(wrapper.find(".wb-field__error").exists()).toBe(false);
  });

  it("edit 模式不触发动作", async () => {
    const wrapper = mountRenderer(page([nameInput, submitButton, countText], { form: { name: "" }, list: [] }), "edit");
    const button = wrapper.findAll("button").find((b) => b.text().includes("提交"));
    await button!.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.text()).toContain("共 0 条");
  });

  it("show 指令为假时渲染但隐藏", () => {
    const wrapper = mountRenderer(
      page(
        [
          {
            id: "n_hide",
            component: "text",
            props: { text: "空列表提示" },
            directives: [{ name: "show", value: "list.length > 0" }],
          },
        ],
        { list: [] },
      ),
    );
    const paragraph = wrapper.find("p");
    expect(paragraph.exists()).toBe(true);
    expect(paragraph.attributes("style")).toContain("display: none");
  });

  it("if 指令为假时不渲染", () => {
    const wrapper = mountRenderer(
      page(
        [
          {
            id: "n_if",
            component: "text",
            props: { text: "不该出现" },
            directives: [{ name: "if", value: "list.length > 0" }],
          },
        ],
        { list: [] },
      ),
    );
    expect(wrapper.text()).not.toContain("不该出现");
  });

  it("for 指令按数组长度展开", () => {
    const wrapper = mountRenderer(
      page(
        [
          {
            id: "n_loop",
            component: "text",
            props: { text: "{{item.name}}" },
            directives: [{ name: "for", value: "{{list}}" }],
          },
        ],
        { list: [{ name: "甲" }, { name: "乙" }, { name: "丙" }] },
      ),
    );
    const paragraphs = wrapper.findAll("p");
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs.map((p) => p.text())).toEqual(["甲", "乙", "丙"]);
  });

  it("未知组件降级为占位块且保留子节点", () => {
    const wrapper = mountRenderer(
      page([
        {
          id: "n_unknown",
          component: "ghost-widget",
          children: [{ id: "n_child", component: "text", props: { text: "子节点还在" } }],
        },
      ]),
    );
    expect(wrapper.find(".wb-node__unknown").exists()).toBe(true);
    expect(wrapper.text()).toContain("ghost-widget");
    expect(wrapper.text()).toContain("子节点还在");
  });

  it("空 Schema 显示空状态而不是白屏", () => {
    const wrapper = mountRenderer(page([]));
    expect(wrapper.find(".wb-renderer__empty").exists()).toBe(true);
  });

  it("style 与表达式绑定同时生效", () => {
    const wrapper = mountRenderer(
      page(
        [
          {
            id: "n_style",
            component: "text",
            props: { text: "样式测试" },
            style: { color: "#ff0000", fontSize: "18px" },
          },
        ],
        {},
      ),
    );
    const paragraph = wrapper.find("p");
    expect(paragraph.attributes("style")).toContain("color: rgb(255, 0, 0)");
    expect(paragraph.attributes("style")).toContain("font-size: 18px");
  });
});
