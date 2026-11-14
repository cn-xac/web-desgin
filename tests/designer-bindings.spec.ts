// @vitest-environment jsdom
/**
 * 设计器三个新入口的端到端验证（真实点击，不 mock 组件）：
 * - 绑定选择器（ruUqAF）：列出可绑定数据 → 点一条即完成绑定；
 * - 选项录入弹窗（rSulo9）：一行一选项，名称在前值在后；
 * - 外部数据源弹窗（rg4KCt）：配置后写进页面级 externalSources，节点用 externalRef 引用。
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
import { useSubMapDialog } from "@/designer/dialogs";
import { NativeTooltip } from "@/designer/ui/native";
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

describe("设计器：不可变元素禁用外部数据源", () => {
  it("内容不可被用户改变的元素不能添加外部数据源", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "t1",
      component: "text",
      props: { text: "说明文字" },
    });

    const btn = wrapper.find(".props__ext");
    expect(btn.exists()).toBe(true);
    // 弱禁用：按钮仍可见，但标成不可用
    expect(btn.classes()).toContain("is-disabled");

    await btn.trigger("click");
    await tick();

    // 弹窗不打开，也没有写入任何配置
    expect(wrapper.find(".wbd-modal__title").exists()).toBe(false);
    expect(store.page.children[0].externalRef).toBeUndefined();
    expect(Object.keys(store.page.externalSources ?? {}).length).toBe(0);
  });

  it("内容可被用户改变的元素仍可添加外部数据源", async () => {
    const { wrapper } = await mountWithNode({
      id: "i1",
      component: "input",
      props: { label: "姓名" },
    });

    const btn = wrapper.find(".props__ext");
    expect(btn.classes()).not.toContain("is-disabled");

    await btn.trigger("click");
    await tick();
    expect(wrapper.find(".wbd-modal__title").text()).toContain("外部数据源");
  });
});

describe("设计器：外部数据源绑定到点击的源元素", () => {
  it("弹窗不再提供触发元素选择，触发值固定取自绑定元素", async () => {
    const { wrapper, store } = await mountWithNode({
      id: "i1",
      component: "input",
      props: { label: "姓名" },
    });

    await wrapper.find(".props__ext").trigger("click");
    await tick();

    // 触发元素变为只读展示，界面里不再有「触发字段」选择器
    expect(wrapper.find(".ext__static").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("触发字段");

    await wrapper.find('input[placeholder="/api/dept/list"]').setValue("/api/dept/list");
    await wrapper.find(".ext__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    const source = store.page.externalSources?.[node.externalRef ?? ""];
    expect(source?.url).toBe("/api/dept/list");
    // 触发元素由绑定关系决定，不再单独写 triggerPath
    expect(source?.triggerPath).toBeUndefined();
    expect(node.externalRef).toBeTruthy();
  });
});

describe("设计器：显示内容模板与单元素默认选中（#3）", () => {
  it("只有一个可输入元素时，新增响应映射默认选中它", async () => {
    const { wrapper } = await mountWithNode({
      id: "i1",
      component: "input",
      props: { label: "姓名" },
    });

    await wrapper.find(".props__ext").trigger("click");
    await tick();

    const addResponse = wrapper
      .findAll(".ext__ghost--block")
      .find((btn) => btn.text().includes("添加响应映射"));
    expect(addResponse).toBeTruthy();
    await addResponse!.trigger("click");
    await tick();

    // 唯一候选元素被自动选中：写入路径即该元素的绑定路径
    const scopePath = wrapper.find('input[placeholder="如 external.deptList"]');
    expect((scopePath.element as HTMLInputElement).value).toBe("form.i1");
    // 目标为可输入元素 → 提供「显示内容」配置
    expect(wrapper.find(".ext__resp").text()).toContain("显示内容");
  });
});

describe("设计器：子映射（#4）", () => {
  /** 挂载一个「输入框（拥有者）+ 子表单（响应目标）」的页面，并预置一条指向子表单的响应映射 */
  async function mountWithSubFormTarget() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(DesignerView, {
      props: { pageId },
      global: { plugins: [pinia] },
    });
    await tick(60);

    const store = useDesignerStore(pinia);
    store.setPage({
      ...blankTemplate("子映射测试"),
      children: [
        { id: "i1", component: "input", props: { label: "姓名" }, externalRef: "ext_1" },
        {
          id: "sf1",
          component: "ec-subform",
          props: { label: "明细", itemPath: "items" },
          children: [{ id: "g1", component: "ec-input", props: { label: "商品" } }],
        },
      ],
      externalSources: {
        ext_1: {
          id: "ext_1",
          url: "/api/rows",
          responses: [{ scopePath: "form.items", shape: "form", parentField: "items" }],
        },
      },
    });
    store.select("i1");
    await tick(40);
    return { wrapper, store };
  }

  it("响应目标是子表单时，主映射出现父字段名与子映射入口", async () => {
    const { wrapper } = await mountWithSubFormTarget();

    await wrapper.find(".props__ext").trigger("click");
    await tick();

    const resp = wrapper.find(".ext__resp");
    expect(resp.exists()).toBe(true);
    expect(resp.text()).toContain("父字段名");
    expect(resp.text()).toContain("设置子映射");
  });

  it("子映射弹窗列出子表单字段，带说明图标与说明项", async () => {
    const { wrapper } = await mountWithSubFormTarget();

    const subMap = useSubMapDialog();
    void subMap.open({
      responseIndex: 0,
      parentField: "items",
      groupNodeId: "sf1",
      label: "明细",
      maps: [],
    });
    await tick();

    // 说明图标 + 说明项
    expect(wrapper.find(".wbd-tip__trigger").exists()).toBe(true);
    expect(wrapper.find(".sub__tip").text()).toContain("每一行");

    // 左侧是子表单里已有的字段
    const row = wrapper.find(".sub__row");
    expect(row.exists()).toBe(true);
    expect(row.text()).toContain("商品");

    // 右侧填响应字段名后确定
    await wrapper.find(".sub__input").setValue("goodsName");
    await wrapper.find(".sub__ok").trigger("click");
    await tick();
    expect(subMap.visible.value).toBe(false);
  });
});

describe("设计器：外部数据源弹窗交互修正", () => {
  /** 打开外部数据源弹窗（挂在一个输入框上） */
  async function openExternalDialog() {
    const mounted = await mountWithNode({
      id: "i1",
      component: "input",
      props: { label: "姓名" },
    });
    await mounted.wrapper.find(".props__ext").trigger("click");
    await tick();
    return mounted;
  }

  /** 在主弹窗里找到「请求头」按钮 */
  function headersButton(wrapper: ReturnType<typeof mountWithNode>["wrapper"]) {
    return wrapper.findAll(".ext__ghost").find((btn) => btn.text().includes("请求头"));
  }

  it("请求头删除后确定，再次打开不再存在", async () => {
    const { wrapper, store } = await openExternalDialog();
    await wrapper.find('input[placeholder="/api/dept/list"]').setValue("/api/dept/list");

    // 加一条请求头
    await headersButton(wrapper)!.trigger("click");
    await tick();
    await wrapper.find(".hdr__add").trigger("click");
    await tick();
    const keyInput = wrapper.find('input[placeholder="名称，如 Authorization"]');
    await keyInput.setValue("X-Token");
    await wrapper.find('input[placeholder="取值"]').setValue("abc");
    await wrapper.find(".hdr__ok").trigger("click");
    await tick();
    expect(headersButton(wrapper)!.text()).toContain("已设置 1 个请求头");

    // 再打开并删掉这一条
    await headersButton(wrapper)!.trigger("click");
    await tick();
    await wrapper.find(".hdr__del").trigger("click");
    await tick();
    await wrapper.find(".hdr__ok").trigger("click");
    await tick();
    expect(headersButton(wrapper)!.text()).toContain("设置请求头");
    expect(headersButton(wrapper)!.text()).not.toContain("已设置");

    // 保存主弹窗：请求头确实没了
    await wrapper.find(".ext__ok").trigger("click");
    await tick();
    const node = store.page.children[0];
    const source = store.page.externalSources?.[node.externalRef ?? ""];
    expect(source).toBeTruthy();
    expect(source?.url).toBe("/api/dept/list");
    expect(source?.headers).toBeUndefined();
  });

  it("请求头弹窗取消时保留原有请求头", async () => {
    const { wrapper, store } = await openExternalDialog();
    await wrapper.find('input[placeholder="/api/dept/list"]').setValue("/api/dept/list");

    await headersButton(wrapper)!.trigger("click");
    await tick();
    await wrapper.find(".hdr__add").trigger("click");
    await tick();
    await wrapper.find('input[placeholder="名称，如 Authorization"]').setValue("X-Token");
    await wrapper.find(".hdr__ok").trigger("click");
    await tick();

    // 再次打开后取消：原值应保留
    await headersButton(wrapper)!.trigger("click");
    await tick();
    await wrapper.find(".hdr__cancel").trigger("click");
    await tick();
    expect(headersButton(wrapper)!.text()).toContain("已设置 1 个请求头");

    await wrapper.find(".ext__ok").trigger("click");
    await tick();
    const node = store.page.children[0];
    const source = store.page.externalSources?.[node.externalRef ?? ""];
    expect(source?.headers).toEqual({ "X-Token": "" });
  });

  it("请求参数映射的删除按钮与输入框同处一行", async () => {
    const { wrapper } = await openExternalDialog();

    const addParam = wrapper.findAll(".ext__ghost--block").find((btn) => btn.text().includes("添加参数"));
    await addParam!.trigger("click");
    await tick();

    const row = wrapper.find(".ext__param");
    // 一行内三列：参数名、元素下拉、删除按钮
    expect(row.findAll("input").length).toBe(1);
    expect(row.findAll("button").length).toBe(1);
    expect(row.find(".ext__del").exists()).toBe(true);
  });

  it("响应映射的目标元素与列表字段并排，说明收进问号图标", async () => {
    const { wrapper } = await openExternalDialog();

    const addResponse = wrapper
      .findAll(".ext__ghost--block")
      .find((btn) => btn.text().includes("添加响应映射"));
    await addResponse!.trigger("click");
    await tick();

    // 目标元素与列表字段在同一行，各占一半
    const targetRow = wrapper.find(".ext__resp-target");
    expect(targetRow.exists()).toBe(true);
    expect(targetRow.findAll("input").length).toBe(1);

    // 说明改为问号图标（HelpTip 组件），鼠标指向时展示
    const help = wrapper.find(".wbd-tip__trigger");
    expect(help.exists()).toBe(true);
    expect(help.attributes("aria-label")).toBeTruthy();
    // 卡片内不再铺开说明正文
    expect(wrapper.find(".ext__resp").find(".ext__note").exists()).toBe(false);
  });

  it("问号提示弹层挂到 body，不会被弹窗的 overflow 裁剪", async () => {
    // 直接测引擎自带的原生回落实现（宿主适配包提供 Tooltip 时走的是它那条路）
    const wrapper = mount(NativeTooltip, {
      props: { text: "说明文案" },
      slots: { default: '<button class="trg">?</button>' },
    });
    await wrapper.find(".trg").trigger("mouseover");
    await tick();

    const pop = document.body.querySelector(".wbd-tip__pop");
    expect(pop).toBeTruthy();
    expect(pop?.textContent).toContain("说明文案");
    // 触发点在组件内、弹层在 body 上 → 不受任何 overflow 容器裁剪
    expect(wrapper.element.contains(pop)).toBe(false);
  });
});

// 这三个用例吃的是扩展仓的专有物料（ec-tree-select / ec-transfer），
// CI 干净环境没有兄弟仓 EP 适配包，属性面板里不会有 optionPair 字段 → 整块跳过。
describe.skipIf(!__HAS_ELEMENT_PLUS__)("设计器：选项类元素复用同一个选项弹窗", () => {
  /** 打开某个元素属性面板里的选项弹窗（optionPair 类型才有这个入口） */
  async function openOptionsDialog(component: string, id: string) {
    const mounted = await mountWithNode({ id, component, props: {} });
    const editBtn = mounted.wrapper
      .findAll(".props__options-btn")
      .find((btn) => btn.text().includes("编辑"));
    expect(editBtn).toBeTruthy();
    await editBtn!.trigger("click");
    await tick();
    return mounted;
  }

  it("树选择的选项走同一个弹窗，能写入层级路径", async () => {
    const { wrapper, store } = await openOptionsDialog("ec-tree-select", "ts1");

    // 弹窗里是「一行一选项」的统一录入形态
    expect(wrapper.find(".opts__text").exists()).toBe(true);
    await wrapper.find(".opts__text").setValue("集团总部/技术中心\n集团总部/产品中心");
    await wrapper.find(".opts__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    expect(String(node.props?.options)).toContain("集团总部/技术中心");
  });

  it("穿梭框的选项走同一个弹窗", async () => {
    const { wrapper, store } = await openOptionsDialog("ec-transfer", "tr1");

    expect(wrapper.find(".opts__text").exists()).toBe(true);
    await wrapper.find(".opts__text").setValue("华东 华\n华南 南");
    await wrapper.find(".opts__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    expect(String(node.props?.options)).toContain("华东 华");
  });

  it("树选择也能使用选项数据源", async () => {
    const { wrapper, store } = await openOptionsDialog("ec-tree-select", "ts1");

    // 打开「使用选项数据源」并配置
    await wrapper.find(".opts__source-switch input").setValue(true);
    await tick();
    await wrapper.find('input[placeholder="/api/dict/list"]').setValue("/api/org/list");
    await wrapper.find(".opts__ok").trigger("click");
    await tick();

    const node = store.page.children[0];
    // 选项被绑定到结果路径
    expect(String(node.props?.options)).toBe("{{options.ts1}}");
    // 数据源写在页面级，节点只引用
    const ref = node.externalRef;
    expect(ref).toBeTruthy();
    const source = store.page.externalSources?.[ref ?? ""];
    expect(source?.url).toBe("/api/org/list");
    expect(source?.asOptions).toBe(true);
  });
});
