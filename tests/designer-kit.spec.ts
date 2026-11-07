// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { UI_ADAPTER } from "@x-ac/design-vue";
import { createMemoryRepository } from "@x-ac/design-vue/designer";
import { MATERIALS } from "@x-ac/design-core";
import DesignerView from "@/designer/DesignerView.vue";
import { blankTemplate } from "@/data/templates";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
  // 导出按钮会走 URL.createObjectURL 造下载链接，jsdom 没实现
  const scope = globalThis as unknown as { URL: typeof URL };
  if (typeof scope.URL.createObjectURL !== "function") {
    scope.URL.createObjectURL = () => "blob:mock";
    scope.URL.revokeObjectURL = () => undefined;
  }
});

/** 只有渲染物料、没有 designer kit 的适配包：设计器应回落到内置原生控件 */
const bareAdapter = {
  name: "bare",
  components: {},
  materials: [],
};

async function mountDesigner(provide?: Record<symbol, unknown>) {
  const seed = blankTemplate("设计器控件测试");
  const wrapper = mount(DesignerView, {
    props: { pageId: seed.id, repository: createMemoryRepository([seed]) },
    global: {
      plugins: [createPinia()],
      ...(provide ? { provide } : {}),
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  return wrapper;
}

describe("设计器控件跟随适配包（D3）", () => {
  it("适配包没有 designer kit 时，回落到内置原生控件且照常可用", async () => {
    const wrapper = await mountDesigner({ [UI_ADAPTER as symbol]: bareAdapter });

    expect(wrapper.findAll("button.wbd-btn").length).toBeGreaterThan(0);
    expect(wrapper.html()).not.toContain("el-button");
    expect(wrapper.text()).toContain("导出 JSON");

    const exportButton = wrapper.findAll("button").find((button) => button.text() === "导出 JSON");
    expect(exportButton).toBeTruthy();
    await exportButton!.trigger("click");
    expect(wrapper.emitted("export-schema")).toBeTruthy();
  });

  it("适配包提供 designer kit 时，设计器用该 UI 库的控件", async () => {
    // 不覆盖 provide：走 tests/setup.ts 注入的 Element Plus 适配包
    const wrapper = await mountDesigner();

    expect(wrapper.html()).toContain("el-button");
    expect(wrapper.findAll("button.wbd-btn").length).toBe(0);
  });
});

/**
 * 物料目录（有哪些物料）与组件表（当前库实现了哪些）是两个来源。
 * 切库后 Schema 里可能残留别的库的物料——面板要让它看得见但拖不动，
 * 否则用户会以为拖进去就能用。
 */
describe("物料面板按适配包能力置灰", () => {
  /** 只实现输入框，其余 25 个协议物料都缺 */
  const partialAdapter = {
    name: "partial",
    components: { "ec-input": () => null },
    materials: MATERIALS,
  };

  it("缺实现的物料置灰、不可拖拽，并给出原因", async () => {
    const wrapper = await mountDesigner({ [UI_ADAPTER as symbol]: partialAdapter });

    const disabled = wrapper.findAll(".palette__item.is-disabled");
    expect(disabled).toHaveLength(MATERIALS.length - 1);
    expect(disabled[0].attributes("draggable")).toBe("false");
    expect(wrapper.text()).toContain("当前 UI 库未实现");

    // 有实现的那个照常可拖
    const enabled = wrapper.findAll(".palette__item").filter((item) => !item.classes().includes("is-disabled"));
    expect(enabled).toHaveLength(1);
    expect(enabled[0].attributes("draggable")).toBe("true");
  });

  it("适配包覆盖全部物料时不置灰", async () => {
    // Element Plus 适配包实现了全部 26 个协议物料
    const wrapper = await mountDesigner();
    expect(wrapper.findAll(".palette__item.is-disabled")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("当前 UI 库未实现");
  });

  it("声明了物料但一个都没实现时全部置灰，并在底部说明", async () => {
    const wrapper = await mountDesigner({ [UI_ADAPTER as symbol]: { name: "none", components: {}, materials: MATERIALS } });

    expect(wrapper.findAll(".palette__item.is-disabled")).toHaveLength(MATERIALS.length);
    expect(wrapper.text()).toContain("灰色物料当前 UI 库未实现");
  });
});
