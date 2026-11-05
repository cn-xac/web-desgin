// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import DesignerView from "@/designer/DesignerView.vue";
import { blankTemplate } from "@/data/templates";
import { localStorageRepo, savePage } from "@/api/pageRepo";
import { setPageRepository } from "@x-ac/design-vue/designer";

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

async function mountDesigner(pageId: string) {
  // 设计器已与路由解耦：直接传 pageId，跳转靠事件
  const wrapper = mount(DesignerView, {
    props: { pageId },
    global: { plugins: [createPinia(), ElementPlus] },
  });
  await new Promise((r) => setTimeout(r, 30));
  return wrapper;
}

describe("设计器整页装配", () => {
  let pageId = "";

  beforeEach(() => {
    localStorage.clear();
    setPageRepository(localStorageRepo);
    pageId = savePage(blankTemplate("装配测试")).id;
  });

  it("渲染三栏与物料面板", async () => {
    const wrapper = await mountDesigner(pageId);
    expect(wrapper.find(".palette").exists()).toBe(true);
    expect(wrapper.find(".stage").exists()).toBe(true);
    expect(wrapper.find(".inspector").exists()).toBe(true);
    expect(wrapper.text()).toContain("输入框");
    expect(wrapper.text()).toContain("页面设置");
    expect(wrapper.text()).toContain("0 个节点");
  });

  it("点击物料把节点加进画布并自动选中", async () => {
    const wrapper = await mountDesigner(pageId);
    const item = wrapper.findAll(".palette__item").find((node) => node.text().includes("输入框"));
    expect(item).toBeTruthy();

    await item!.trigger("click");
    await new Promise((r) => setTimeout(r, 30));

    expect(wrapper.text()).toContain("1 个节点");
    // 选中后右侧切到属性面板，出现「标签」字段
    expect(wrapper.text()).toContain("标签");
    // 画布上出现真实的 Element Plus 输入框
    expect(wrapper.find(".canvas__body input").exists()).toBe(true);
  });

  it("画布节点可被选中并显示面包屑", async () => {
    const wrapper = await mountDesigner(pageId);
    const card = wrapper.findAll(".palette__item").find((node) => node.text().includes("卡片"));
    await card!.trigger("click");
    await new Promise((r) => setTimeout(r, 30));

    const nodeElement = wrapper.find(".canvas__body .wb-node--design");
    expect(nodeElement.exists()).toBe(true);
    await nodeElement.trigger("click");
    await new Promise((r) => setTimeout(r, 30));
    expect(wrapper.find(".inspector__crumbs").text()).toContain("卡片");
  });
});
