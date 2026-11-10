// @vitest-environment jsdom
/**
 * T-032：业务组件注册链路。
 *
 * 一份声明（组件实现 + 元数据 + 属性编辑方式）→ 适配包 → 设计器面板 / 渲染器。
 * 覆盖三件事：声明的归一化与拦截、组合的不可变性、真实渲染与属性面板的落地。
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ElementPlus from "element-plus";
import { defineComponent, h } from "vue";
import {
  createEmptyPage,
  createRegistry,
  defineMaterial,
  MATERIALS,
  missingComponents,
  registerMaterials,
  type UiAdapter,
} from "@x-ac/design-core";
import { SchemaRenderer, UI_ADAPTER } from "@x-ac/design-vue";
import { elementPlusAdapter } from "@x-ac/design-vue-element-plus";
import { useDesignerStore } from "@/designer/store";
import PropsEditor from "@/designer/components/PropsEditor.vue";
import PalettePanel from "@/designer/components/PalettePanel.vue";
import RiskBadge from "@/demo-materials/RiskBadge.vue";

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

beforeEach(() => {
  localStorage.clear();
});

const riskBadge = {
  component: "biz-risk-badge",
  title: "风险徽章",
  kind: "field" as const,
  impl: RiskBadge,
  props: { text: "风险待评估", level: "中", color: "", round: true },
  fields: [
    { key: "text", label: "文案", type: "text" as const },
    { key: "level", label: "等级", type: "select" as const, options: ["高", "中", "低"] },
    { key: "color", label: "自定义颜色", type: "color" as const },
    { key: "round", label: "圆角", type: "boolean" as const },
    { key: "maxlength", label: "最多字数", type: "number" as const },
  ],
};

/** 去掉适配包的设计器控件，让内置原生控件出场（断言 input[type=color] 需要） */
function withoutKit(adapter: UiAdapter<unknown>): UiAdapter<unknown> {
  return { ...adapter, designer: undefined };
}

describe("defineMaterial 归一化", () => {
  it("只写 component 与 impl 也能得到完整物料", () => {
    const { material, impl } = defineMaterial({ component: "biz-plain", impl: RiskBadge });
    expect(impl).toBe(RiskBadge);
    expect(material).toMatchObject({
      component: "biz-plain",
      title: "biz-plain",
      category: "业务",
      kind: "display",
      icon: "b",
      owner: "user",
      portable: false,
      defaultProps: {},
      fields: [],
    });
  });

  it("标题首字作图标，中文按码点取", () => {
    expect(defineMaterial({ component: "biz-a", title: "风险徽章" }).material.icon).toBe("风");
    expect(defineMaterial({ component: "biz-b", title: "  " }).material.icon).toBe("b");
  });

  it("字段按名字推断 portability，显式标注优先", () => {
    const { material } = defineMaterial({
      component: "biz-field",
      fields: [
        { key: "text", label: "文案", type: "text" },
        { key: "maxlength", label: "长度", type: "number" },
        { key: "color", label: "颜色", type: "color" },
        { key: "size", label: "尺寸", type: "text", portability: "behavior" },
      ],
    });
    expect(material.fields.map((field) => field.portability)).toEqual(["content", "behavior", "visual", "behavior"]);
  });

  it("不修改入参，也不共享引用（改输入不影响物料）", () => {
    const props = { text: "原值" };
    const fields = [{ key: "text", label: "文案", type: "text" as const }];
    const { material } = defineMaterial({ component: "biz-immutable", props, fields });

    expect(fields[0].portability).toBeUndefined();
    props.text = "改过了";
    fields[0].label = "改过了";
    expect(material.defaultProps).toEqual({ text: "原值" });
    expect(material.fields[0].label).toBe("文案");
  });

  it("拒绝空 component 与占用 ec- 协议命名空间", () => {
    expect(() => defineMaterial({ component: "  " })).toThrow(/component 不能为空/);
    expect(() => defineMaterial({ component: "ec-input" })).toThrow(/协议命名空间/);
    expect(() => defineMaterial({ component: "ec-input" })).toThrow(/withMaterials/);
  });
});

describe("registerMaterials 组合", () => {
  it("返回新适配包，原适配包不受影响", () => {
    const before = elementPlusAdapter.materials.length;
    const adapter = registerMaterials(elementPlusAdapter, [riskBadge]);

    expect(adapter).not.toBe(elementPlusAdapter);
    expect(adapter.materials).not.toBe(elementPlusAdapter.materials);
    expect(elementPlusAdapter.materials).toHaveLength(before);
    expect(adapter.materials).toHaveLength(before + 1);
    expect(adapter.name).toBe(elementPlusAdapter.name);
    expect(adapter.actions).toBe(elementPlusAdapter.actions);
  });

  it("组件表按协议名归一写入，物料目录可按裸名或协议名查到", () => {
    const adapter = registerMaterials(elementPlusAdapter, [riskBadge]);
    const registry = createRegistry(adapter.materials);

    expect(adapter.components["ec-biz-risk-badge"]).toBe(RiskBadge);
    expect(registry.get("biz-risk-badge")?.title).toBe("风险徽章");
    expect(registry.get("ec-biz-risk-badge")?.owner).toBe("user");
    expect(registry.knownComponents().has("ec-biz-risk-badge")).toBe(true);
  });

  it.skipIf(!__HAS_ELEMENT_PLUS__)("已提供实现的业务物料不再出现在缺失清单里，缺实现的仍在", () => {
    const adapter = registerMaterials(elementPlusAdapter, [riskBadge, { component: "biz-pending" }]);
    expect(missingComponents(adapter)).toEqual(["biz-pending"]);
  });

  it("空声明原样返回同一引用，不产生多余副本", () => {
    expect(registerMaterials(elementPlusAdapter, [])).toBe(elementPlusAdapter);
  });

  it("同一批重复注册直接报错，而不是悄悄只留一个", () => {
    expect(() => registerMaterials(elementPlusAdapter, [riskBadge, riskBadge])).toThrow(/重复注册/);
  });

  it("与已有物料同名默认报错，overwrite 才覆盖", () => {
    const adapter = registerMaterials(elementPlusAdapter, [riskBadge]);
    expect(() => registerMaterials(adapter, [riskBadge])).toThrow(/同名/);

    const overwritten = registerMaterials(
      adapter,
      [{ ...riskBadge, title: "风险等级" }],
      { overwrite: true },
    );
    expect(createRegistry(overwritten.materials).get("biz-risk-badge")?.title).toBe("风险等级");
    expect(overwritten.materials).toHaveLength(adapter.materials.length);
  });
});

describe("业务物料进入渲染器", () => {
  function mountPage(adapter: UiAdapter<unknown> | null, component: string, props: Record<string, unknown>) {
    const page = {
      schemaVersion: "1.0.0",
      id: "page_biz",
      type: "page" as const,
      meta: { title: "业务物料", device: "pc" as const },
      children: [{ id: "n_badge", component, props }],
    };
    return mount(SchemaRenderer, {
      props: { page, adapter: adapter ?? undefined },
      global: { plugins: [ElementPlus] },
    });
  }

  it("注册后按自己的实现渲染，不走未知组件占位", () => {
    const adapter = registerMaterials(elementPlusAdapter, [riskBadge]);
    const wrapper = mountPage(adapter, "biz-risk-badge", { text: "高风险", level: "高" });

    expect(wrapper.text()).toContain("高风险");
    expect(wrapper.text()).toContain("高");
    expect(wrapper.find(".wb-node__unknown").exists()).toBe(false);
    // kind=field → 走字段外壳；标签来自节点 props.label，默认值不落库
    expect(wrapper.find(".wb-field").exists()).toBe(true);
  });

  it("未注册时降级占位，不白屏", () => {
    const wrapper = mountPage(elementPlusAdapter, "biz-risk-badge", { text: "高风险" });
    expect(wrapper.find(".wb-node__unknown").exists()).toBe(true);
    expect(wrapper.text()).toContain("biz-risk-badge");
  });
});

describe("业务物料进入设计器面板", () => {
  function setup(adapter: UiAdapter<unknown>) {
    setActivePinia(createPinia());
    const store = useDesignerStore();
    store.setPage(createEmptyPage("业务物料"));
    store.setMaterialCatalog(createRegistry(adapter.materials));
    store.addNode("biz-risk-badge");
    return store;
  }

  function mountProps(adapter: UiAdapter<unknown>) {
    return mount(PropsEditor, {
      global: { provide: { [UI_ADAPTER as symbol]: adapter } },
    });
  }

  it("属性面板列出业务字段，color 用取色控件、select 用下拉", () => {
    const adapter = withoutKit(registerMaterials(elementPlusAdapter, [riskBadge]));
    setup(adapter);
    const wrapper = mountProps(adapter);

    expect(wrapper.text()).toContain("风险徽章");
    expect(wrapper.text()).toContain("自定义颜色");
    expect(wrapper.find('input[type="color"]').exists()).toBe(true);
    expect(wrapper.find("select").exists()).toBe(true);
    expect(wrapper.text()).toContain("最多字数");
  });

  it("适配包可以用 editors 覆盖某类字段的编辑器", () => {
    const Probe = defineComponent({
      props: { modelValue: { type: String, default: "" } },
      setup: () => () => h("div", { class: "probe-editor" }, "自定义编辑器"),
    });
    const base = registerMaterials(elementPlusAdapter, [riskBadge]);
    const adapter: UiAdapter<unknown> = { ...withoutKit(base), editors: { text: Probe } };
    setup(adapter);

    const wrapper = mountProps(adapter);
    expect(wrapper.find(".probe-editor").exists()).toBe(true);
    expect(wrapper.find('input[type="color"]').exists()).toBe(true); // 其余类型仍走内置
  });

  it("物料面板出现业务物料，并带「自」标记", () => {
    const adapter = withoutKit(registerMaterials(elementPlusAdapter, [riskBadge]));
    setup(adapter);
    const wrapper = mount(PalettePanel, {
      global: { provide: { [UI_ADAPTER as symbol]: adapter } },
    });

    expect(wrapper.text()).toContain("风险徽章");
    expect(wrapper.findAll(".palette__own")).toHaveLength(1);
    // 官方物料同时在场，且不带标记
    expect(wrapper.text()).toContain("输入框");
  });

  it("core 默认清单里没有业务物料", () => {
    expect(MATERIALS.some((material) => material.component === "biz-risk-badge")).toBe(false);
  });
});
