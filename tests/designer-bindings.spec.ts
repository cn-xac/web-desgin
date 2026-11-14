// @vitest-environment jsdom
/**
 * 设计器三个新入口的端到端验证（真实点击，不 mock 组件）：
 * - 绑定选择器（ruUqAF）：列出可绑定数据 → 点一条即完成绑定；
 * - 选项录入弹窗（rSulo9）：一行一选项，名称在前值在后；
 * - 外部数据源弹窗（rg4KCt）：配置后写进 node.dataSource。
 *
 * 用例不依赖适配包：直接往 store 里放 Schema 再选中节点，
 * 这样 CI（stub 适配器）与本地（真实 EP 适配包）跑的是同一套断言。
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DesignerView from "@/designer/DesignerView.vue";
import { useDesignerStore } from "@/designer/store";
import { blankTemplate } from "@/data/templates";
import { localStorageRepo, savePage } from "@/api/pageRepo";
import { setPageRepository } from "@x-ac/web-design-vue/designer";
import type { NodeSchema } from "@x-ac/web-design-core";

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
  pageId = savePage(blankTemplate("绑定测试")).id;
});

/** 挂载设计器并直接放一个节点进去、选中它 */
async function mountWithNode(node: NodeSchema) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(DesignerView, {
    props: { pageId },
    global: { plugins: [pinia] },
  });
  await tick(60);

  const store = useDesignerStore(pinia);
  store.setPage({ ...blankTemplate("绑定测试"), children: [node] });
  store.select(node.id);
  await tick(40);
  return { wrapper, store };
}

describe("设计器：绑定数据选择器", () => {
  it("列出可绑定数据，点一条即完成 {{}} 绑定", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "f1",
      component: "input",
      props: { label: "姓名" },
    });

    // 属性面板每个字段右侧都有绑定入口
    const bindButtons = wrapper.findAll(".props__link");
    expect(bindButtons.length).toBeGreaterThan(0);

    await bindButtons[0].trigger("click");
    await tick();

    const title = wrapper.find(".wbd-modal__title");
    expect(title.exists()).toBe(true);
    expect(title.text()).toContain("选择可绑定数据");

    // 清单里至少有一条（刚放的表单控件本身）
    const items = wrapper.findAll(".picker__item");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].text()).toContain("form.f1");

    await items[0].trigger("click");
    await tick();

    const node = store.page.children[0];
    const bound = Object.values(node.props ?? {}).find((value) => String(value).includes("{{"));
    expect(String(bound)).toMatch(/^\{\{.+\}\}$/);
  });

  it("已绑定的属性可清除绑定", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "f1",
      component: "input",
      props: { label: "姓名" },
    });

    await wrapper.findAll(".props__link")[0].trigger("click");
    await tick();
    await wrapper.findAll(".picker__item")[0].trigger("click");
    await tick();

    // 再打开一次，这次点「清除绑定」
    await wrapper.findAll(".props__link")[0].trigger("click");
    await tick();
    const unbind = wrapper.find(".picker__unbind");
    expect(unbind.exists()).toBe(true);
    await unbind.trigger("click");
    await tick();

    const node = store.page.children[0];
    const bound = Object.values(node.props ?? {}).find((value) => String(value).includes("{{"));
    expect(bound).toBeUndefined();
  });
});

describe("设计器：选项录入弹窗", () => {
  it("独立弹窗录入「一行一选项、名称在前值在后」，并写回 Schema", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "r1",
      component: "radio",
      props: { label: "部门" },
    });

    const entry = wrapper.find(".props__options-btn");
    expect(entry.exists()).toBe(true);

    await entry.trigger("click");
    await tick();
    expect(wrapper.find(".wbd-modal__title").text()).toContain("编辑");

    const textarea = wrapper.find(".opts__text");
    expect(textarea.exists()).toBe(true);
    await textarea.setValue("技术中心 tech\n产品中心 product");
    await tick();

    // 解析预览能看到名称与值
    const preview = wrapper.findAll(".opts__preview-row");
    expect(preview).toHaveLength(2);
    expect(preview[0].text()).toContain("技术中心");
    expect(preview[0].text()).toContain("tech");

    await wrapper.find(".opts__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    expect(String(node.props?.options)).toBe("技术中心 tech\n产品中心 product");
  });
});

describe("设计器：外部数据源弹窗", () => {
  it("配置后写进 node.dataSource", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "s1",
      component: "select",
      props: { label: "部门" },
    });

    await wrapper.find(".props__ext").trigger("click");
    await tick();
    expect(wrapper.find(".wbd-modal__title").text()).toContain("外部数据源");

    const url = wrapper.find('input[placeholder="/api/dept/list"]');
    expect(url.exists()).toBe(true);
    await url.setValue("/api/dept/list");

    const name = wrapper.find('input[placeholder="如 部门列表"]');
    await name.setValue("部门列表");

    await wrapper.find(".ext__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    const ref = node.externalRef;
    expect(ref).toBeTruthy();
    const source = store.page.externalSources?.[ref!];
    expect(source?.url).toBe("/api/dept/list");
    expect(source?.name).toBe("部门列表");
    // 缺省「只请求一次」
    expect(source?.once).toBe(true);
  });

  it("移除数据源会清掉节点上的配置", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "s1",
      component: "select",
      props: { label: "部门" },
    });

    await wrapper.find(".props__ext").trigger("click");
    await tick();
    await wrapper.find('input[placeholder="/api/dept/list"]').setValue("/api/dept/list");
    await wrapper.find(".ext__ok").trigger("click");
    await tick();
    const inserted = store.page.externalSources ?? {};
    expect(Object.values(inserted).some((s) => s.url === "/api/dept/list")).toBe(true);

    await wrapper.find(".props__ext").trigger("click");
    await tick();
    await wrapper.find(".ext__remove").trigger("click");
    await tick();
    expect(store.page.children[0].externalRef).toBeUndefined();
    expect(Object.keys(store.page.externalSources ?? {}).length).toBe(0);
  });
});
