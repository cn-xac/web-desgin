// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import {
  bareKey,
  createRegistry,
  DEFAULT_BINDING,
  fieldPortability,
  getMaterial,
  isCustomMaterial,
  isProtocolMaterial,
  MATERIALS,
  materialKey,
  missingComponents,
  registry,
  resolveDefaults,
  summarizePortability,
  withMaterials,
  type Material,
  type NodeSchema,
  type PageSchema,
  type UiAdapter,
} from "@x-ac/design-core";

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

describe("物料命名空间（ec- 前缀）", () => {
  it("裸名转协议名，且幂等", () => {
    expect(materialKey("input")).toBe("ec-input");
    expect(materialKey("ec-input")).toBe("ec-input");
  });

  it("协议名转裸名，且对裸名幂等", () => {
    expect(bareKey("ec-org-picker")).toBe("org-picker");
    expect(bareKey("input")).toBe("input");
  });

  it("清单里的组件名全部带前缀", () => {
    for (const material of MATERIALS) {
      expect(material.component).toBe(materialKey(material.component));
      expect(isProtocolMaterial(material.component)).toBe(true);
    }
  });

  it("不带前缀的名字视为业务自定义物料", () => {
    expect(isCustomMaterial("biz-org-tree")).toBe(true);
    expect(isProtocolMaterial("biz-org-tree")).toBe(false);
  });
});

describe("物料注册表", () => {
  it("协议名与历史裸名查到同一份 meta", () => {
    expect(getMaterial("ec-input")?.title).toBe("输入框");
    expect(getMaterial("input")?.title).toBe("输入框");
  });

  it("默认值解析接受两种写法", () => {
    expect(resolveDefaults("ec-input", {}).placeholder).toBe(resolveDefaults("input", {}).placeholder);
  });

  it("按分类返回物料，且总数一致", () => {
    const grouped = registry.byCategory();
    const total = grouped.reduce((sum, group) => sum + group.items.length, 0);
    expect(total).toBe(MATERIALS.length);
    expect(grouped.map((group) => group.category)).toEqual(["布局", "展示", "表单", "交互", "业务"]);
  });

  it("missing 报出注册表里没有的组件", () => {
    expect(registry.missing(["ec-input", "biz-org-tree"])).toEqual(["biz-org-tree"]);
  });

  it("createRegistry 归一化传入的裸名", () => {
    const custom = createRegistry([{ ...(getMaterial("ec-title") as Material), component: "title" }]);
    expect(custom.has("ec-title")).toBe(true);
    expect(custom.has("title")).toBe(true);
  });
});

describe("属性可移植性三档", () => {
  it("显式标注优先于推断", () => {
    expect(fieldPortability({ key: "maxlength", portability: "visual" })).toBe("visual");
  });

  it("按语义推断：行为 / 内容 / 视觉", () => {
    expect(fieldPortability({ key: "maxlength" })).toBe("behavior");
    expect(fieldPortability({ key: "placeholder" })).toBe("content");
    expect(fieldPortability({ key: "borderRadius" })).toBe("visual");
  });

  it("汇总一个物料的属性分档", () => {
    const summary = summarizePortability([
      { key: "label", label: "标签", type: "text" },
      { key: "maxlength", label: "最大长度", type: "number" },
      { key: "borderRadius", label: "圆角", type: "number" },
    ]);
    expect(summary).toEqual({ behavior: ["maxlength"], content: ["label"], visual: ["borderRadius"] });
  });
});

describe("适配包组合", () => {
  const input = getMaterial("ec-input") as Material;
  const button = getMaterial("ec-button") as Material;

  const adapter: UiAdapter<object> = {
    name: "fake-ui",
    components: { "ec-input": {}, "ec-button": {} },
    materials: [input, button],
  };

  it("缺省绑定通道是 modelValue / onUpdate:modelValue", () => {
    expect(DEFAULT_BINDING).toEqual({ prop: "modelValue", event: "onUpdate:modelValue" });
  });

  it("自检能报出没有实现的物料", () => {
    expect(missingComponents(adapter)).toEqual([]);
    expect(missingComponents({ ...adapter, components: { "ec-input": {} } })).toEqual(["ec-button"]);
  });

  it("withMaterials 不修改原适配包（避免全局单例污染）", () => {
    const custom: Material = {
      component: "biz-org-tree",
      title: "组织树",
      category: "业务",
      kind: "field",
      icon: "◎",
      defaultProps: {},
      fields: [],
      owner: "user",
      portable: false,
    };
    const merged = withMaterials(adapter, [custom]);

    expect(adapter.materials).toHaveLength(2);
    expect(merged.materials).toHaveLength(3);
    expect(merged.materials[2].component).toBe("biz-org-tree");
    expect(merged.materials[2].owner).toBe("user");
    expect(merged.materials[2].portable).toBe(false);
  });

  it("同名物料以后注册的为准", () => {
    const patched: Material = { ...input, title: "输入框（改）" };
    const merged = withMaterials(adapter, [patched]);
    expect(merged.materials).toHaveLength(2);
    expect(merged.materials.find((item) => item.component === "ec-input")?.title).toBe("输入框（改）");
  });
});

describe("渲染器吃 ec- 前缀", () => {
  it("带前缀的节点能渲染出真实控件", async () => {
    const { mount } = await import("@vue/test-utils");
    const { default: ElementPlus } = await import("element-plus");
    const { SchemaRenderer } = await import("@x-ac/design-vue");
    const node: NodeSchema = {
      id: "n_name",
      component: "ec-input",
      props: { label: "姓名", placeholder: "请输入姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }],
    };
    const page: PageSchema = {
      schemaVersion: "1.0.0",
      id: "page_prefix",
      type: "page",
      meta: { title: "前缀渲染", device: "pc" },
      state: { form: { name: "" } },
      children: [node],
    };

    const wrapper = mount(SchemaRenderer, {
      props: { page, mode: "view" },
      global: { plugins: [ElementPlus] },
    });

    expect(wrapper.find("input").exists()).toBe(true);
    expect(wrapper.text()).toContain("姓名");
    expect(wrapper.find(".wb-field__req").exists()).toBe(true);
  });

  it("未注入适配包时降级为占位，不抛错", async () => {
    const { mount } = await import("@vue/test-utils");
    const { SchemaRenderer, UI_ADAPTER } = await import("@x-ac/design-vue");

    const page: PageSchema = {
      schemaVersion: "1.0.0",
      id: "page_no_adapter",
      type: "page",
      meta: { title: "无适配包", device: "pc" },
      children: [{ id: "n_x", component: "ec-input", props: { label: "姓名" } }],
    };

    const wrapper = mount(SchemaRenderer, {
      props: { page },
      global: { provide: { [UI_ADAPTER as symbol]: null } },
    });

    expect(wrapper.text()).toContain("未知组件");
    expect(wrapper.html()).toContain("ec-input");
  });

  it("绑定通道由适配包决定（value 方言也能驱动 scope）", async () => {
    const { mount } = await import("@vue/test-utils");
    const { defineComponent, h } = await import("vue");
    const { SchemaRenderer, UI_ADAPTER } = await import("@x-ac/design-vue");

    const ValueInput = defineComponent({
      name: "ValueInput",
      props: { value: { type: String, default: "" } },
      emits: ["update:value"],
      setup(props, { emit }) {
        return () =>
          h("input", {
            class: "fake-input",
            value: props.value,
            onInput: (event: Event) => emit("update:value", (event.target as HTMLInputElement).value),
          });
      },
    });

    const page: PageSchema = {
      schemaVersion: "1.0.0",
      id: "page_value_dialect",
      type: "page",
      meta: { title: "value 方言", device: "pc" },
      state: { form: { name: "" } },
      children: [{ id: "n_name", component: "ec-input", props: { label: "姓名", modelValue: "{{form.name}}" } }],
    };

    const wrapper = mount(SchemaRenderer, {
      props: {
        page,
        adapter: { name: "fake", components: { "ec-input": ValueInput }, materials: MATERIALS, binding: { prop: "value", event: "onUpdate:value" } },
      },
      global: { provide: { [UI_ADAPTER as symbol]: null } },
    });

    await wrapper.find(".fake-input").setValue("张三");
    const emitted = wrapper.emitted("update:data") as Array<[Record<string, unknown>]> | undefined;
    expect(emitted?.at(-1)?.[0]).toEqual({ form: { name: "张三" } });
  });
});
