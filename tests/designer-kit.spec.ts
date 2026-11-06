// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { UI_ADAPTER } from "@x-ac/design-vue";
import { createMemoryRepository } from "@x-ac/design-vue/designer";
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
