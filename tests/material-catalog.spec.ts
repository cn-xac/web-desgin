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
import { elementPlusAdapter, elementPlusMaterials, EP_FIELD_PATCHES } from "@x-ac/design-vue-element-plus";
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
  it("27 个物料，字段全部固化了显式 portability", () => {
    expect(MATERIALS).toHaveLength(27);
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

describe.skipIf(!__HAS_ELEMENT_PLUS__)("Element Plus 适配包物料清单", () => {
  it("core 物料全部保留并追加 EP 专有属性", () => {
    // 打补丁不是替换：core 的每个物料都必须还在清单里
    for (const material of MATERIALS) {
      expect(elementPlusMaterials.some((item) => item.component === material.component)).toBe(true);
    }
    expect(elementPlusMaterials.length).toBeGreaterThan(MATERIALS.length);
    expect(epFields.length).toBeGreaterThan(coreFields.length);
    expect(elementPlusAdapter.materials).toBe(elementPlusMaterials);
    expect(fieldOf(elementPlusMaterials, "ec-input", "showWordLimit")).toBeTruthy();
    expect(fieldOf(elementPlusMaterials, "ec-button", "loading")).toBeTruthy();
  });

  it("EP 专有物料统一标 portable: false", () => {
    const extras = elementPlusMaterials.filter(
      (item) => !MATERIALS.some((core) => core.component === item.component),
    );
    expect(extras.length).toBeGreaterThan(30);
    expect(extras.every((item) => item.portable === false)).toBe(true);
    expect(extras.every((item) => item.owner === "adapter")).toBe(true);
    // 专有物料也要参与分类与物料面板，不能是「注册了但拖不出来」
    expect(extras.every((item) => Boolean(item.category) && Boolean(item.title))).toBe(true);
  });

  it("专有字段都带 portability 与分组", () => {
    // 补丁表里的字段：属性面板靠 group 分组，靠 portability 做跨库取舍，
    // 缺一个就会「默默归到基础组」或「默默当成视觉差异」
    const patchFields = Object.values(EP_FIELD_PATCHES).flat();
    expect(patchFields.length).toBeGreaterThan(60);
    expect(patchFields.filter((field) => !field.group).map((field) => `${field.key}`)).toEqual([]);
    expect(patchFields.filter((field) => !field.portability).map((field) => field.key)).toEqual([]);

    // EP 专有物料的字段同样要有分组与档位
    const extraMaterials = elementPlusMaterials.filter(
      (item) => !MATERIALS.some((core) => core.component === item.component),
    );
    const extraFields = extraMaterials.flatMap((item) => item.fields);
    expect(extraFields.length).toBeGreaterThan(100);
    expect(extraFields.filter((field) => !field.group).map((field) => field.key)).toEqual([]);
    expect(extraFields.filter((field) => !field.portability).map((field) => field.key)).toEqual([]);
  });

  it("core 清单不含任何 EP 专有字段", () => {
    expect(fieldOf(MATERIALS, "ec-input", "showWordLimit")).toBeUndefined();
  });
});

describe("设计器属性面板跟随适配包", () => {
  it.skipIf(!__HAS_ELEMENT_PLUS__)("注入 EP 适配包时显示专有字段", () => {
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
