// @vitest-environment jsdom
/**
 * 三端渲染一致性（r5u4Ul C 块）：Vue / React / 静态 HTML 导出
 * 共用 core 的 resolveVisibility，验证显隐优先级、外部控制与 for 裸表达式。
 */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { renderToStaticMarkup } from "react-dom/server";
import { SchemaRenderer as VueRenderer } from "@x-ac/web-design-vue";
import { SchemaRenderer as ReactRenderer } from "@x-ac/web-design-react";
import { toHtml, type NodeSchema, type PageSchema } from "@x-ac/web-design-core";

const state = { form: { type: "company", qty: 3 }, list: [1, 2] };

function makePage(node: NodeSchema): PageSchema {
  return {
    schemaVersion: "1.1.0",
    id: "p_visibility",
    type: "page",
    meta: { title: "显隐渲染", device: "pc" },
    state,
    children: [node],
  };
}

const hit = {
  mode: "and" as const,
  rows: [{ left: "form.type", operator: "eq" as const, value: "company" }],
};

const textNode = (visibility?: NodeSchema["visibility"], directives?: NodeSchema["directives"]): NodeSchema => ({
  id: "t1",
  component: "text",
  props: { text: "目标文本" },
  ...(visibility ? { visibility } : {}),
  ...(directives ? { directives } : {}),
});

function mountVue(page: PageSchema, visibility?: Record<string, { visible: boolean; force?: boolean }>) {
  return mount(VueRenderer, { props: { page, ...(visibility ? { visibility } : {}) } });
}

describe("Vue 渲染器：显隐优先级", () => {
  it("隐藏条件命中时包裹层带 is-hidden", () => {
    const wrapper = mountVue(makePage(textNode({ hide: hit })));
    expect(wrapper.find(".wb-node.is-hidden").exists()).toBe(true);
  });

  it("显示条件命中时覆盖隐藏条件", () => {
    const wrapper = mountVue(makePage(textNode({ show: hit, hide: hit })));
    expect(wrapper.find(".wb-node.is-hidden").exists()).toBe(false);
  });

  it("外部强制控制优先于本地条件", () => {
    const hidden = mountVue(makePage(textNode({ show: hit })), { t1: { visible: false, force: true } });
    expect(hidden.find(".wb-node.is-hidden").exists()).toBe(true);

    const shown = mountVue(makePage(textNode({ hide: hit })), { t1: { visible: true, force: true } });
    expect(shown.find(".wb-node.is-hidden").exists()).toBe(false);
  });

  it("外部非强制在本地条件均未命中时生效", () => {
    const wrapper = mountVue(makePage(textNode()), { t1: { visible: false } });
    expect(wrapper.find(".wb-node.is-hidden").exists()).toBe(true);
  });

  it("旧 directives 行为不回归：show 为假时隐藏，if 为假时不渲染", () => {
    const hidden = mountVue(makePage(textNode(undefined, [{ name: "show", value: "false" }])));
    expect(hidden.find(".wb-node.is-hidden").exists()).toBe(true);
    const skipped = mountVue(makePage(textNode(undefined, [{ name: "if", value: "false" }])));
    expect(skipped.find(".wb-node").exists()).toBe(false);
  });
});

describe("React / 静态 HTML 导出：同一份 Schema 结果一致", () => {
  it("隐藏条件命中时输出 display:none，显示命中时不输出", () => {
    const hidden = makePage(textNode({ hide: hit }));
    const shown = makePage(textNode({ show: hit, hide: hit }));
    expect(renderToStaticMarkup(<ReactRenderer page={hidden} />)).toContain("display:none");
    expect(renderToStaticMarkup(<ReactRenderer page={shown} />)).not.toContain("display:none");
    expect(toHtml(hidden)).toContain("display:none");
    expect(toHtml(shown)).not.toContain("display:none");
  });

  it("外部 force 控制同样作用于 React 渲染器", () => {
    const markup = renderToStaticMarkup(
      <ReactRenderer page={makePage(textNode({ show: hit }))} visibility={{ t1: { visible: false, force: true } }} />,
    );
    expect(markup).toContain("display:none");
  });

  it("裸表达式 for 在三端都展开（消除既存分叉）", () => {
    const loop = makePage(textNode(undefined, [{ name: "for", value: "list" }]));
    const vueCount = mountVue(loop).findAll(".wb-node").length;
    const reactMarkup = renderToStaticMarkup(<ReactRenderer page={loop} />);
    const html = toHtml(loop);

    expect(vueCount).toBe(2);
    expect(reactMarkup.match(/目标文本/g)?.length).toBe(2);
    expect(html.match(/目标文本/g)?.length).toBe(2);
  });
});

describe("子表单：运行时行级隔离", () => {
  const subformPage: PageSchema = {
    schemaVersion: "1.1.0",
    id: "p_subform_visibility",
    type: "page",
    meta: { title: "子表单显隐" },
    state: { form: { orders: [{ qty: 1 }, { qty: 5 }], outside: "company" } },
    children: [
      {
        id: "orders",
        component: "ec-subform",
        props: { label: "订单", itemPath: "orders" },
        children: [
          {
            id: "row_text",
            component: "text",
            props: { text: "明细行" },
            // 只能读本行 qty；若隔离失效，outside 的存在会让条件仍能命中
            visibility: {
              hide: {
                mode: "and",
                rows: [{ left: "form.orders[0].qty", operator: "gt", value: 3 }],
              },
            },
          },
        ],
      },
    ],
  };

  it("仅第二行（qty=5）命中隐藏条件", () => {
    const wrapper = mount(VueRenderer, { props: { page: subformPage } });
    expect(wrapper.findAll(".wb-node.is-hidden")).toHaveLength(1);
  });

  it("子表单内条件读不到外部字段，隔离生效", () => {
    const isolatedPage: PageSchema = JSON.parse(JSON.stringify(subformPage)) as PageSchema;
    const child = isolatedPage.children[0].children?.[0];
    if (child?.visibility?.hide) {
      child.visibility.hide.rows = [{ left: "form.outside", operator: "eq", value: "company" }];
    }
    const wrapper = mount(VueRenderer, { props: { page: isolatedPage } });
    expect(wrapper.findAll(".wb-node.is-hidden")).toHaveLength(0);
  });
});
