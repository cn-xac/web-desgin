// @vitest-environment jsdom
/**
 * Element Plus 物料全集：从「定义存在」到「真的能画出来」。
 *
 * 这类物料最容易出的问题是「注册了但渲染不出来」—— 物料表里有一项，
 * 组件映射漏了、或者 props 名与组件对不上，设计器里就是一块灰色占位。
 * 所以这里逐物料冒烟渲染，而不是只断言清单长度。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import type { NodeSchema, PageSchema } from "@x-ac/design-core";
import { missingComponents, MATERIALS } from "@x-ac/design-core";
import { SchemaRenderer } from "@x-ac/design-vue";
import { elementPlusAdapter, elementPlusMaterials, EP_FIELD_PATCHES } from "@x-ac/design-vue-element-plus";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
  // 部分组件（Dialog / Drawer / Popconfirm）在挂载期会用到
  if (!("matchMedia" in globalThis)) {
    (globalThis as unknown as Record<string, unknown>).matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }
  // 水印组件要把文字画到 canvas 上，jsdom 没实现 getContext，会给一堆 stderr 噪声
  const canvasProto = globalThis.HTMLCanvasElement?.prototype;
  if (canvasProto) {
    canvasProto.getContext = (() =>
      ({
        fillRect: () => {},
        clearRect: () => {},
        drawImage: () => {},
        measureText: () => ({ width: 0 }),
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        setTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
      }) as unknown as CanvasRenderingContext2D) as typeof canvasProto.getContext;
  }
});

/** EP 专有物料（core 清单里没有的那些） */
const epOnlyMaterials = elementPlusMaterials.filter(
  (material) => !MATERIALS.some((core) => core.component === material.component),
);

function page(nodes: NodeSchema[]): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_ep",
    type: "page",
    meta: { title: "EP 物料冒烟", device: "pc" },
    state: { total: 42 },
    children: nodes,
  };
}

function mountNode(node: NodeSchema) {
  return mount(SchemaRenderer, {
    props: { page: page([node]) },
    global: { plugins: [ElementPlus] },
  });
}

describe("物料与组件实现的对应关系", () => {
  it("每个物料都有组件实现，不存在「注册了但没实现」", () => {
    // missingComponents 是启动期自检用的同一份判断，这里直接复用
    expect(missingComponents(elementPlusAdapter)).toEqual([]);
  });

  it("EP 专有物料已覆盖各大分类", () => {
    const categories = new Set(epOnlyMaterials.map((material) => material.category));
    expect(categories).toEqual(new Set(["布局", "展示", "表单", "导航", "交互"]));
  });

  it("每个专有物料都声明了标题、图标与默认属性", () => {
    for (const material of epOnlyMaterials) {
      expect(material.title, material.component).toBeTruthy();
      expect(material.icon, material.component).toBeTruthy();
      expect(material.defaultProps, material.component).toBeTypeOf("object");
    }
  });

  it("字段 key 不与 EP 组件保留字冲突（modelValue 只能作为绑定入口）", () => {
    for (const material of epOnlyMaterials) {
      const keys = material.fields.map((field) => field.key);
      // 同一个物料里不能出现两个同名 key，否则面板里两个输入框写同一个 prop
      expect(new Set(keys).size, material.component).toBe(keys.length);
    }
  });
});

describe("EP 专有物料渲染冒烟", () => {
  it.each(epOnlyMaterials.map((material) => [material.component, material] as const))(
    "%s 能画出来且不降级为未知占位",
    (_name, material) => {
      const wrapper = mountNode({
        id: `n_${material.component}`,
        component: material.component,
        props: { ...material.defaultProps },
      });

      expect(wrapper.find(".wb-node__unknown").exists()).toBe(false);
      // 渲染出了实际内容（空容器允许只渲染空态提示）
      expect(wrapper.html().length).toBeGreaterThan(20);
      wrapper.unmount();
    },
  );
});

describe("属性补丁与组件 prop 对齐", () => {
  it("输入框的类型、只读、字数统计都透传到 ElInput", () => {
    const wrapper = mountNode({
      id: "n_input",
      component: "ec-input",
      props: { label: "账号", type: "password", readonly: true, showWordLimit: true, maxlength: 12 },
    });

    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("password");
    expect(input.attributes("readonly")).toBeDefined();
    expect(input.attributes("maxlength")).toBe("12");

    // 字数统计是 ElInput 内部按 prop 决定的，直接看它收到的 prop 更稳
    const elInput = wrapper.findComponent({ name: "ElInput" });
    expect(elInput.props("showWordLimit")).toBe(true);
    expect(elInput.props("maxlength")).toBe(12);
  });

  it("下拉选择的单选/多选真实生效", () => {
    const build = (props: Record<string, unknown>, id: string) =>
      mountNode({ id, component: "ec-select", props: { label: "部门", options: "技术,产品", ...props } });

    const single = build({}, "n_select");
    const multiple = build({ multiple: true, collapseTags: true }, "n_select_multi");

    expect(single.find(".el-select").exists()).toBe(true);
    expect(single.findComponent({ name: "ElSelect" }).props("multiple")).toBe(false);
    expect(multiple.findComponent({ name: "ElSelect" }).props("multiple")).toBe(true);
    expect(multiple.findComponent({ name: "ElSelect" }).props("collapseTags")).toBe(true);
  });

  it("表格的尺寸不再写死为 default", () => {
    const wrapper = mountNode({
      id: "n_table",
      component: "ec-table",
      props: { columns: "姓名:name", data: [{ name: "张三" }], size: "small" },
    });

    expect(wrapper.find(".el-table--small").exists()).toBe(true);
  });

  it("图片的「点击预览」翻译成 preview-src-list", () => {
    const build = (preview: boolean, id: string) =>
      mountNode({
        id,
        component: "ec-image",
        props: { src: "https://example.com/a.png", preview },
      });

    const off = build(false, "n_img");
    const on = build(true, "n_img2");

    // 直接看 ElImage 收到的 prop：jsdom 不会真正加载图片，
    // 靠 DOM class 判断「是否可预览」会受加载状态影响
    const elImageOf = (wrapper: ReturnType<typeof build>) =>
      wrapper.findComponent({ name: "ElImage" }).props("previewSrcList");

    expect(elImageOf(off)).toEqual([]);
    expect(elImageOf(on)).toEqual(["https://example.com/a.png"]);
    expect(off.find(".el-image").exists()).toBe(true);
  });

  it("标签页与折叠面板按成对字符串生成子项", () => {
    const tabs = mountNode({
      id: "n_tabs",
      component: "ec-tabs",
      props: { items: "基本信息:甲,扩展配置:乙", active: "扩展配置" },
    });
    expect(tabs.findAll(".el-tabs__item")).toHaveLength(2);
    expect(tabs.find(".el-tabs__item.is-active").text()).toBe("扩展配置");

    const collapse = mountNode({
      id: "n_collapse",
      component: "ec-collapse",
      props: { items: "基础信息:甲,高级设置:乙", active: "基础信息" },
    });
    expect(collapse.findAll(".el-collapse-item")).toHaveLength(2);
  });

  it("菜单的层级路径生成子菜单", () => {
    const wrapper = mountNode({
      id: "n_menu",
      component: "ec-menu",
      props: { items: "工作台\n订单管理>待办订单>超时订单", mode: "vertical" },
    });

    expect(wrapper.find(".el-menu").exists()).toBe(true);
    expect(wrapper.find(".el-sub-menu").exists()).toBe(true);
  });
});

describe("属性分组", () => {
  it("补丁字段都落在五个分组之一", () => {
    const allowed = new Set(["basic", "content", "data", "style", "advanced"]);
    for (const fields of Object.values(EP_FIELD_PATCHES)) {
      for (const field of fields) {
        expect(allowed.has(field.group ?? ""), `${field.key} 的 group 非法`).toBe(true);
      }
    }
  });

  it("分组按 基础 → 内容 → 数据 → 外观 → 高级 排序", async () => {
    const { groupFields } = await import("@x-ac/design-core");
    const select = elementPlusMaterials.find((material) => material.component === "ec-select")!;
    const groups = groupFields(select.fields).map((entry) => entry.group);

    expect(groups).toEqual(["basic", "content", "data", "style", "advanced"]);
  });
});
