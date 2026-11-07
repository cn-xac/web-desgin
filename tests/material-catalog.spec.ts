// @vitest-environment jsdom
/**
 * P3：物料元数据来源与可移植性标注。
 * 覆盖「core 通用清单 → 适配包专有清单 → 设计器属性面板」整条链路。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ElementPlus from "element-plus";
import {
  createEmptyPage,
  createRegistry,
  MATERIALS,
  resolveDefaults,
  type Material,
} from "@x-ac/design-core";
import { UI_ADAPTER } from "@x-ac/design-vue";
import { elementPlusAdapter, elementPlusMaterials } from "@x-ac/design-vue-element-plus";
import { useDesignerStore } from "@/designer/store";
import PropsEditor from "@/designer/components/PropsEditor.vue";

const coreFields = MATERIALS.flatMap((material) => material.fields);
const epFields = elementPlusMaterials.flatMap((material) => material.fields);

function fieldOf(materials: Material[], component: string, key: string) {
  return materials.find((item) => item.component === component)?.fields.find((field) => field.key === key);
}

function mountPropsPanel(adapter: unknown, withElementPlus = false) {
  setActivePinia(createPinia());
  const store = useDesignerStore();
  store.setPage(createEmptyPage("属性面板测试"));
  store.addNode("ec-input");
  return mount(PropsEditor, {
    global: {
      ...(withElementPlus ? { plugins: [ElementPlus] } : {}),
      provide: { [UI_ADAPTER as symbol]: adapter },
    },
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("core 通用物料清单", () => {
  it("26 个物料，字段全部固化了显式 portability", () => {
    expect(MATERIALS).toHaveLength(26);
    expect(coreFields.length).toBeGreaterThan(100);
    expect(coreFields.every((field) => Boolean(field.portability))).toBe(true);
  });

  it("三档均有覆盖，且行为档占比最高", () => {
    const counts = coreFields.reduce<Record<string, number>>((acc, field) => {
      acc[field.portability!] = (acc[field.portability!] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.keys(counts).sort()).toEqual(["behavior", "content", "visual"]);
    expect(counts.behavior).toBeGreaterThan(counts.visual);
  });

  it("同名不同义字段按物料显式覆盖", () => {
    expect(fieldOf(MATERIALS, "ec-date", "type")?.portability).toBe("behavior");
    expect(fieldOf(MATERIALS, "ec-button", "type")?.portability).toBe("visual");
    expect(fieldOf(MATERIALS, "ec-tag", "type")?.portability).toBe("visual");
  });

  it("通用字段扩展已生效", () => {
    const input = MATERIALS.find((item) => item.component === "ec-input");
    expect(input?.fields.map((field) => field.key)).toContain("maxlength");
    expect(fieldOf(MATERIALS, "ec-link", "href")?.portability).toBe("content");
  });

  it("注入式 registry 的 defaults 与 core 全局 resolveDefaults 一致", () => {
    const registry = createRegistry(MATERIALS);
    expect(registry.defaults("ec-input", { label: "姓名" })).toEqual(resolveDefaults("ec-input", { label: "姓名" }));
    expect(registry.knownComponents().has("ec-input")).toBe(true);
  });
});

describe("Element Plus 适配包物料清单", () => {
  it("在通用清单上追加专有字段，物料数与结构字段不变", () => {
    expect(elementPlusMaterials).toHaveLength(MATERIALS.length);
    expect(epFields.length).toBeGreaterThan(coreFields.length);
    expect(elementPlusAdapter.materials).toBe(elementPlusMaterials);
    expect(fieldOf(elementPlusMaterials, "ec-input", "showWordLimit")).toBeTruthy();
    expect(fieldOf(elementPlusMaterials, "ec-button", "loading")).toBeTruthy();
  });

  it("专有字段也带 portability，且以 visual 为主", () => {
    const extra = epFields.slice(coreFields.length);
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.every((field) => Boolean(field.portability))).toBe(true);
    expect(extra.filter((field) => field.portability === "visual").length).toBeGreaterThan(0);
  });

  it("core 清单不含任何 EP 专有字段", () => {
    expect(fieldOf(MATERIALS, "ec-input", "showWordLimit")).toBeUndefined();
  });
});

describe("设计器属性面板跟随适配包", () => {
  it("注入 EP 适配包时显示专有字段", () => {
    const wrapper = mountPropsPanel(elementPlusAdapter, true);
    expect(wrapper.text()).toContain("字数统计");
    expect(wrapper.text()).toContain("最大长度");
  });

  it("未注入适配包时回落到 core 通用清单", () => {
    const wrapper = mountPropsPanel(null);
    expect(wrapper.text()).toContain("最大长度");
    expect(wrapper.text()).not.toContain("字数统计");
  });
});

describe("自定义物料", () => {
  it("store 注入自定义目录后可创建自定义物料节点", () => {
    setActivePinia(createPinia());
    const store = useDesignerStore();
    const custom: Material = {
      component: "biz-org-tree",
      title: "组织树选择",
      category: "业务",
      kind: "field",
      icon: "◎",
      defaultProps: {},
      fields: [],
      owner: "user",
      portable: false,
    };
    store.setMaterialCatalog(createRegistry([...MATERIALS, custom]));
    store.addNode("biz-org-tree");
    expect(store.page.children[0]?.component).toBe("biz-org-tree");
  });
});
