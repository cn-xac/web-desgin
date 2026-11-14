// @vitest-environment jsdom
/**
 * 设计器条件配置弹窗端到端验证（真实点击，不 mock 组件）。
 * 与 designer-bindings.spec.ts 同一套挂载方式：CI stub 与本地真实 EP 都能跑。
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DesignerView from "@/designer/DesignerView.vue";
import { useDesignerStore } from "@/designer/store";
import { blankTemplate } from "@/data/templates";
import { localStorageRepo, savePage } from "@/api/pageRepo";
import { setPageRepository } from "@x-ac/web-design-vue/designer";
import { collectConditionElements, type NodeSchema, type PageSchema } from "@x-ac/web-design-core";

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
  pageId = savePage(blankTemplate("显隐测试")).id;
});

/** 放两个节点：目标自身 + 一个可作为条件左元素的字段 */
async function mountWithNodes(target: NodeSchema) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(DesignerView, {
    props: { pageId },
    global: { plugins: [pinia] },
  });
  await tick(60);

  const store = useDesignerStore(pinia);
  store.setPage({
    ...blankTemplate("显隐测试"),
    children: [target, { id: "f2", component: "input", props: { label: "部门" } }],
  });
  store.select(target.id);
  await tick(40);
  return { wrapper, store };
}

async function openConditionDialog(wrapper: Awaited<ReturnType<typeof mountWithNodes>>["wrapper"], index: number) {
  const tabs = wrapper.findAll(".inspector__tab");
  const styleTab = tabs.find((tab) => tab.text().includes("样式"));
  expect(styleTab).toBeTruthy();
  await styleTab!.trigger("click");
  await tick();

  const buttons = wrapper.findAll(".style__cond-btn");
  expect(buttons).toHaveLength(2);
  await buttons[index].trigger("click");
  await tick();
}

describe("设计器：显示 / 隐藏条件弹窗", () => {
  it("打开弹窗、选左元素与关系、保存后写回 node.visibility", async () => {
    const { wrapper, store } = await mountWithNodes({
      id: "f1",
      component: "input",
      props: { label: "姓名" },
    });

    await openConditionDialog(wrapper, 0);
    expect(wrapper.find(".wbd-modal__title").text()).toContain("配置显示条件");
    expect(wrapper.findAll(".cond__row")).toHaveLength(1);

    await wrapper.find(".cond__left").setValue("form.f2");
    await wrapper.find(".cond__value").setValue("sales");
    await wrapper.find(".cond__ok").trigger("click");
    await tick();

    const group = store.page.children[0].visibility?.show;
    expect(group?.mode).toBe("and");
    expect(group?.rows[0]).toMatchObject({ left: "form.f2", operator: "eq", value: "sales" });
  });

  it("高级模式按序号组合，保存后模式与表达式完整", async () => {
    const { wrapper, store } = await mountWithNodes({
      id: "f1",
      component: "input",
      props: { label: "姓名" },
    });

    await openConditionDialog(wrapper, 1);
    expect(wrapper.find(".wbd-modal__title").text()).toContain("配置隐藏条件");

    await wrapper.find(".cond__add").trigger("click");
    await wrapper.find(".cond__add").trigger("click");
    expect(wrapper.findAll(".cond__row")).toHaveLength(3);

    const rows = wrapper.findAll(".cond__row");
    for (const row of rows) {
      await row.find(".cond__only input").setValue(true);
      await row.find(".cond__value--only").setValue("true");
    }

    const advanced = wrapper.findAll(".cond__mode").find((button) => button.text().includes("高级"));
    expect(advanced).toBeTruthy();
    await advanced!.trigger("click");
    await wrapper.find(".cond__expression").setValue("1 and (2 or 3)");
    await wrapper.find(".cond__ok").trigger("click");
    await tick();

    const group = store.page.children[0].visibility?.hide;
    expect(group?.mode).toBe("advanced");
    expect(group?.expression).toBe("1 and (2 or 3)");
    expect(group?.rows).toHaveLength(3);
    expect(group?.rows[0]).toEqual({ value: "true" });
  });

  it("条件摘要在面板上可见，不打开弹窗也能看出配置状态", async () => {
    const { wrapper, store } = await mountWithNodes({
      id: "f1",
      component: "input",
      props: { label: "姓名" },
    });
    store.setVisibility({
      show: { mode: "or", rows: [{ left: "form.f2", operator: "eq", value: "x" }] },
    });
    await tick();

    const tabs = wrapper.findAll(".inspector__tab");
    const styleTab = tabs.find((tab) => tab.text().includes("样式"));
    await styleTab!.trigger("click");
    await tick();

    expect(wrapper.findAll(".style__cond-btn")[0].text()).toContain("1 条 · 或者");
  });
});

describe("条件源清单：子表单单向作用域", () => {
  const page: PageSchema = {
    schemaVersion: "1.1.0",
    id: "p_scope",
    type: "page" as const,
    children: [
      { id: "outside", component: "input", props: { label: "外部字段" } },
      {
        id: "orders",
        component: "ec-subform",
        props: { itemPath: "orders" },
        children: [
          { id: "qty", component: "input", props: { label: "数量" } },
          { id: "name", component: "input", props: { label: "名称" } },
        ],
      },
      {
        id: "goods",
        component: "ec-subform",
        props: { itemPath: "goods" },
        children: [{ id: "price", component: "input", props: { label: "价格" } }],
      },
    ],
  };

  it("子表单内的配置方只能选同一子表单内元素", () => {
    const paths = collectConditionElements(page, { nodeId: "qty" }).map((item) => item.path);
    expect(paths).toContain("form.orders[0].name");
    expect(paths).not.toContain("form.outside");
    expect(paths).not.toContain("form.goods[0].price");
  });

  it("子表单外的配置方可选明细字段，且标记需要聚合", () => {
    const items = collectConditionElements(page, { nodeId: "outside" });
    const detail = items.find((item) => item.path === "form.orders[0].qty");
    expect(detail?.requiresAggregate).toBe(true);
    expect(items.some((item) => item.path === "form.goods[0].price")).toBe(true);
  });
});
