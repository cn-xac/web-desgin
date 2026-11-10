// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { renderToStaticMarkup } from "react-dom/server";
import ElementPlus from "element-plus";
import { SchemaRenderer as VueRenderer } from "@x-ac/web-design-vue";
import { SchemaRenderer as ReactRenderer } from "@x-ac/web-design-react";
import { createDemoPage } from "@/fixtures/createDemoPage";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
});

/**
 * 跨框架一致性：同一个 PageSchema，Vue 与 React 都必须渲染出同样的内容与间距。
 * 这是「core 抽取是否真的成立」的最终判据。
 */
const page = createDemoPage();

function mountVue(): HTMLElement {
  const wrapper = mount(VueRenderer, {
    props: { page },
    global: { plugins: [ElementPlus] },
    attachTo: document.body,
  });
  return wrapper.element as HTMLElement;
}

describe.skipIf(!__HAS_ELEMENT_PLUS__)("同一份 Schema 跨框架渲染", () => {
  const vue = mountVue();
  const reactHtml = renderToStaticMarkup(<ReactRenderer page={page} />);

  const texts = ["员工登记（React 渲染）", "姓名", "部门", "备注", "李思远", "技术中心"];

  it.each(texts)("两侧都出现文案：%s", (text) => {
    expect(vue.textContent).toContain(text);
    expect(reactHtml).toContain(text);
  });

  it("两侧都从 state 求值出列表数据", () => {
    expect(vue.textContent).toContain("2026-11-04 10:12");
    expect(reactHtml).toContain("2026-11-04 10:12");
  });

  it("两侧都渲染表格表头", () => {
    expect(vue.querySelectorAll("th").length).toBeGreaterThan(0);
    expect(reactHtml).toContain("<th");
  });

  it("两侧都保留通用间距声明", () => {
    // 卡片 padding 16px 与字段 margin-bottom 12px
    expect(reactHtml).toContain("padding:16px");
    const field = vue.querySelector(".wb-field") as HTMLElement | null;
    expect(field?.style.marginBottom).toBe("12px");
  });

  it("必填标记两侧一致", () => {
    expect(vue.querySelector(".wb-field__req")).toBeTruthy();
    expect(reactHtml).toContain("ux-req");
  });
});
