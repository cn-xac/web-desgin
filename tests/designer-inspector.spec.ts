// @vitest-environment jsdom
/**
 * 右侧检查器的面板归位：
 * - 选中节点时只有「属性 / 样式 / 校验 / 事件」，Schema 不再挂在节点上；
 * - 未选中节点时是「页面设置 / Schema」两个 Tab，Schema 看的是整页。
 *
 * 与 designer-bindings.spec.ts 同一套挂载方式：直接往 store 放 Schema，
 * 不依赖适配包，CI（stub）与本地（真实 EP）跑同一份断言。
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DesignerView from "@/designer/DesignerView.vue";
import { useDesignerStore } from "@/designer/store";
import { blankTemplate } from "@/data/templates";
import { localStorageRepo, savePage } from "@/api/pageRepo";
import { setPageRepository } from "@x-ac/web-design-vue/designer";

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

const tick = (ms = 40): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let pageId = "";

beforeEach(() => {
  localStorage.clear();
  setPageRepository(localStorageRepo);
  pageId = savePage(blankTemplate("面板测试")).id;
});

async function mountDesigner() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(DesignerView, {
    props: { pageId },
    global: { plugins: [pinia] },
  });
  await tick(60);
  return { wrapper, store: useDesignerStore(pinia) };
}

/** 右侧检查器当前的 Tab 文案（事件/校验带计数徽标，去掉尾部的数字） */
const tabLabels = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll(".inspector__tab").map((item) => item.text().replace(/\d+$/, "").trim());

describe("设计器：Schema 归到页面面板", () => {
  it("选中节点时只有属性/样式/校验/事件，没有 Schema", async () => {
    const { wrapper, store } = await mountDesigner();

    store.setPage({
      ...blankTemplate("面板测试"),
      children: [{ id: "i1", component: "input", props: { label: "姓名" } }],
    });
    store.select("i1");
    await tick(40);

    expect(tabLabels(wrapper)).toEqual(["属性", "样式", "校验", "事件"]);
    expect(wrapper.find(".schema__code").exists()).toBe(false);
  });

  it("未选中时页面面板是「页面设置 / Schema」两个 Tab，能切到整页 Schema", async () => {
    const { wrapper, store } = await mountDesigner();

    store.setPage({ ...blankTemplate("页面 Schema 测试"), children: [] });
    store.select(null);
    await tick(40);

    expect(tabLabels(wrapper)).toEqual(["页面设置", "Schema"]);
    // 默认停在页面设置
    expect(wrapper.find(".settings").exists()).toBe(true);

    await wrapper.findAll(".inspector__tab")[1]!.trigger("click");
    await tick();

    const code = wrapper.find(".schema__code");
    expect(code.exists()).toBe(true);
    // 看的是整页：页面标题在里面
    expect(code.text()).toContain("页面 Schema 测试");
    expect(wrapper.find(".settings").exists()).toBe(false);
  });

  it("从节点回到页面面板时 Schema 不残留为默认页", async () => {
    const { wrapper, store } = await mountDesigner();

    store.setPage({
      ...blankTemplate("面板测试"),
      children: [{ id: "i1", component: "input", props: { label: "姓名" } }],
    });
    store.select("i1");
    await tick(40);

    store.select(null);
    await tick(40);
    // 页面面板仍从「页面设置」起手，不会因为上次看过 Schema 就直接落在 Schema
    expect(wrapper.find(".settings").exists()).toBe(true);
    expect(wrapper.find(".schema__code").exists()).toBe(false);
  });
});
