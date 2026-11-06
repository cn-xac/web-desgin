// @vitest-environment jsdom
/**
 * 标签即用（component-tag）能力验证：
 * <SchemaPage> 与 <SchemaDesigner> 作为独立 Vue 标签的 props / events / slots 契约。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import { defineComponent, h, nextTick, ref } from "vue";
import { SchemaPage } from "@x-ac/design-vue";
import { SchemaDesigner } from "@x-ac/design-vue/designer";
import { createMemoryRepository } from "@x-ac/design-vue/designer";
import { toJSON } from "@x-ac/design-core";
import type { NodeSchema, PageSchema } from "@x-ac/design-core";
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
  // jsdom 没有 Blob URL API，导出下载链路在单测里打桩
  const url = globalThis.URL as unknown as Record<string, unknown>;
  url.createObjectURL ??= () => "blob:mock";
  url.revokeObjectURL ??= () => {};
});

function page(children: NodeSchema[], state: Record<string, unknown> = {}): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_tag",
    type: "page",
    meta: { title: "标签测试", device: "pc" },
    state,
    children,
  };
}

const nameInput: NodeSchema = {
  id: "n_name",
  component: "input",
  props: { label: "姓名", placeholder: "请输入姓名", modelValue: "{{form.name}}" },
};

const submitButton: NodeSchema = {
  id: "n_submit",
  component: "button",
  props: { text: "提交", type: "primary" },
  events: { click: [{ action: "submitForm", args: { from: "form", to: "list" } }] },
};

describe("SchemaPage 标签", () => {
  it("page 可以直接传 JSON 字符串", async () => {
    const schema = page([nameInput]);
    const wrapper = mount(SchemaPage, {
      props: { page: toJSON(schema) },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.find("input").exists()).toBe(true);
    expect(wrapper.text()).toContain("姓名");
  });

  it("page JSON 非法时不白屏，给解析错误提示", () => {
    const wrapper = mount(SchemaPage, {
      props: { page: "{ not valid json" },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.text()).toContain("解析失败");
  });

  it("v-model:data：输入数据同步给宿主，宿主改值回填渲染", async () => {
    const schema = page([nameInput], { form: { name: "" } });

    // 模拟 v-model:data：宿主持有 ref，渲染层 update:data 时整体替换
    const hostData = ref<Record<string, unknown>>({});
    const Host = defineComponent({
      setup() {
        return () =>
          h(SchemaPage, {
            page: schema,
            data: hostData.value,
            "onUpdate:data": (v: Record<string, unknown>) => {
              hostData.value = v;
            },
          });
      },
    });
    const wrapper = mount(Host, { global: { plugins: [ElementPlus] } });
    const tag = wrapper.findComponent(SchemaPage);
    const input = tag.find("input");

    await input.setValue("阿杰");

    // scope → 宿主：update:data 带出了 form.name
    expect((hostData.value.form as Record<string, unknown>).name).toBe("阿杰");

    // 宿主 → scope：改外部数据，渲染层同步（回填）
    hostData.value = { form: { name: "外部改的" } };
    await nextTick();
    await nextTick();
    expect((input.element as HTMLInputElement).value).toBe("外部改的");

    // v-model 回环不产生额外 emit：静置一轮 emit 数量不变
    const before = tag.emitted("update:data")!.length;
    await nextTick();
    expect(tag.emitted("update:data")!.length).toBe(before);
  });

  it("@submit：submitForm 动作提交成功时抛出数据行", async () => {
    const schema = page([nameInput, submitButton], { form: { name: "张三" } });
    const wrapper = mount(SchemaPage, {
      props: { page: schema },
      global: { plugins: [ElementPlus] },
    });

    await wrapper.find("button").trigger("click");
    const events = wrapper.emitted("submit");
    expect(events).toBeTruthy();
    const payload = events![0][0] as Record<string, unknown>;
    // submitForm 抛的是组装好的数据行（含 submitAt），不是整个 scope
    expect(payload.name).toBe("张三");
    expect(typeof payload.submitAt).toBe("string");
  });

  it("empty 插槽可自定义空态", () => {
    const wrapper = mount(SchemaPage, {
      props: { page: page([]) },
      slots: { empty: h("div", { class: "my-empty" }, "这里放一个空态") },
      global: { plugins: [ElementPlus] },
    });
    expect(wrapper.find(".my-empty").text()).toBe("这里放一个空态");
  });

  it("@navigate 事件：动作跳转同时抛事件", async () => {
    const navButton: NodeSchema = {
      id: "n_nav",
      component: "button",
      props: { text: "去列表" },
      events: { click: [{ action: "navigate", args: { to: "/list" } }] },
    };
    const wrapper = mount(SchemaPage, {
      props: { page: page([navButton]) },
      global: { plugins: [ElementPlus] },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("navigate")![0]).toEqual(["/list"]);
  });
});

describe("SchemaDesigner 标签", () => {
  it("repository prop：组件级仓储注入，不碰全局", async () => {
    // forks 单进程下多个测试文件共享一个 jsdom，先清场再验证「不写全局」
    localStorage.clear();

    const seed = blankTemplate("仓储测试");
    const repo = createMemoryRepository([seed]);

    const wrapper = mount(SchemaDesigner, {
      props: { pageId: seed.id, repository: repo },
      global: { plugins: [createPinia(), ElementPlus] },
    });
    await new Promise((r) => setTimeout(r, 30));

    expect(wrapper.text()).toContain("仓储测试");
    // 全局 localStorage 不受影响
    expect(localStorage.length).toBe(0);
  });

  it("exportSchema 事件：导出时把内容抛给宿主", async () => {
    const seed = blankTemplate("导出测试");
    const repo = createMemoryRepository([seed]);

    const wrapper = mount(SchemaDesigner, {
      props: { pageId: seed.id, repository: repo },
      global: { plugins: [createPinia(), ElementPlus] },
    });
    await new Promise((r) => setTimeout(r, 30));

    const exportButton = wrapper.findAll("button").find((b) => b.text() === "导出 JSON");
    expect(exportButton).toBeTruthy();
    exportButton!.trigger("click");
    await new Promise((r) => setTimeout(r, 30));

    const events = wrapper.emitted("export-schema");
    expect(events).toBeTruthy();
    const payload = events![0][0] as { kind: string; content: string; schema: PageSchema };
    expect(payload.kind).toBe("json");
    expect(() => JSON.parse(payload.content)).not.toThrow();
    expect(payload.schema.id).toBe(seed.id);
  });

  it("importSchema 方法：ref 主动灌 JSON，走迁移与校验", async () => {
    const seed = blankTemplate("导入测试");
    const repo = createMemoryRepository([seed]);
    const schema = page([
      { id: "n_title", component: "title", props: { text: "来自导入", size: "large" } },
    ]);

    const wrapper = mount(SchemaDesigner, {
      props: { pageId: seed.id, repository: repo },
      global: { plugins: [createPinia(), ElementPlus] },
    });
    await new Promise((r) => setTimeout(r, 30));

    (wrapper.vm as unknown as { importSchema: (json: string) => boolean }).importSchema(toJSON(schema));
    await new Promise((r) => setTimeout(r, 30));

    expect(wrapper.text()).toContain("来自导入");
    // 非法 JSON 返回 false 不崩
    const bad = (wrapper.vm as unknown as { importSchema: (json: string) => boolean }).importSchema("{{{");
    expect(bad).toBe(false);
  });
});
