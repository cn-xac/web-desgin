// @vitest-environment jsdom
/**
 * 节点事件协议：组件派发的原始参数不再被渲染器吞掉。
 * 覆盖 core 纯函数 + Vue 渲染器集成（React 侧对照见 react-event-parity.spec.tsx）。
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { defineComponent, h, nextTick } from "vue";
import { SchemaRenderer } from "@x-ac/design-vue";
import { elementPlusAdapter } from "@x-ac/design-vue-element-plus";
import {
  camelizeEventName,
  createEventPayload,
  registerMaterials,
  resolveValue,
  runEventHooks,
  toReactHandlerName,
  type ActionSchema,
  type NodeSchema,
  type PageSchema,
  type UiAdapter,
  type UiEventPayload,
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

/** 模拟一个会派发自定义事件、且带多个参数的业务组件 */
const Emitter = defineComponent({
  name: "BizEmitter",
  emits: ["rowClick"],
  setup(_props, { emit }) {
    return () =>
      h(
        "button",
        {
          class: "biz-emitter",
          onClick: (domEvent: MouseEvent) => emit("rowClick", { id: 7, name: "甲" }, 1, domEvent),
        },
        "触发行事件",
      );
  },
});

function makeAdapter(overrides: Partial<UiAdapter<unknown>> = {}): UiAdapter<unknown> {
  return registerMaterials(
    {
      ...elementPlusAdapter,
      actions: { notify: vi.fn(), confirm: async () => true },
      ...overrides,
    } as UiAdapter<unknown>,
    [
      {
        component: "biz-emitter",
        title: "事件发射器",
        impl: Emitter,
        events: [{ name: "row-click", title: "行点击" }],
      },
    ],
  );
}

function makePage(actions: ActionSchema[], state: Record<string, unknown> = { form: { picked: "" } }): PageSchema {
  const node: NodeSchema = {
    id: "n_emit",
    component: "biz-emitter",
    props: {},
    events: { "row-click": actions },
  };
  return {
    schemaVersion: "1.0.0",
    id: "page_event",
    type: "page",
    meta: { title: "事件测试", device: "pc" },
    state,
    children: [node],
  };
}

async function fire(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find("button.biz-emitter").trigger("click");
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("事件名归一化（core）", () => {
  it("kebab → camel / React handler", () => {
    expect(camelizeEventName("row-click")).toBe("rowClick");
    expect(camelizeEventName("click")).toBe("click");
    expect(toReactHandlerName("row-click")).toBe("onRowClick");
    expect(toReactHandlerName("click")).toBe("onClick");
  });

  it("payload 暴露原始参数、首个值与原生事件", () => {
    const native = { target: {}, preventDefault: () => undefined };
    const payload = createEventPayload({
      name: "row-click",
      handlerName: "rowClick",
      node: { id: "n1", component: "table" },
      page: makePage([]),
      scope: {},
      args: [{ id: 1 }, 2, native],
      actions: [],
    });
    expect(payload.value).toEqual({ id: 1 });
    expect(payload.nativeEvent).toBe(native);
    expect(payload.args).toHaveLength(3);
    expect(payload.nodeId).toBe("n1");
  });

  it("钩子返回 false 或 preventDefault 都会阻断后续钩子", () => {
    const payload = createEventPayload({
      name: "click",
      handlerName: "onClick",
      node: { id: "n1", component: "button" },
      page: makePage([]),
      scope: {},
      args: [],
      actions: [],
    });
    const later = vi.fn();
    expect(runEventHooks(payload, [() => false, later])).toBe(false);
    expect(later).not.toHaveBeenCalled();

    const payload2 = createEventPayload({
      name: "click",
      handlerName: "onClick",
      node: { id: "n1", component: "button" },
      page: makePage([]),
      scope: {},
      args: [],
      actions: [],
    });
    expect(
      runEventHooks(payload2, [(p) => p.preventDefault(), later]),
    ).toBe(false);
    expect(later).not.toHaveBeenCalled();
  });

  it("钩子抛错只告警，不让页面崩", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const payload = createEventPayload({
      name: "click",
      handlerName: "onClick",
      node: { id: "n1", component: "button" },
      page: makePage([]),
      scope: {},
      args: [],
      actions: [],
    });
    expect(runEventHooks(payload, [() => { throw new Error("boom"); }, () => undefined])).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Vue 渲染器事件回调", () => {
  it("onEvent 收到完整 payload：节点 / 页面 / scope / 物料 / 原始参数", async () => {
    const onEvent = vi.fn();
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage([]), adapter: makeAdapter(), onEvent },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);

    expect(onEvent).toHaveBeenCalledTimes(1);
    const payload = onEvent.mock.calls[0][0] as UiEventPayload;
    expect(payload.name).toBe("row-click");
    expect(payload.handlerName).toBe("rowClick");
    expect(payload.nodeId).toBe("n_emit");
    expect(payload.component).toBe("biz-emitter");
    expect(payload.material?.title).toBe("事件发射器");
    expect(payload.page.id).toBe("page_event");
    expect(payload.scope).toHaveProperty("form");
    expect(payload.value).toEqual({ id: 7, name: "甲" });
    expect(payload.args[1]).toBe(1);
    expect(payload.nativeEvent).toBeTruthy();
    expect(payload.actions).toEqual([]);
  });

  it("@node-event 是只读通知，拿到同一个 payload", async () => {
    const onEvent = vi.fn();
    const notify = vi.fn();
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage([]), adapter: makeAdapter(), onEvent, onNodeEvent: notify },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toBe(onEvent.mock.calls[0][0]);
    expect(wrapper.emitted("nodeEvent")).toHaveLength(1);
  });

  it("阻止后不执行预设动作", async () => {
    const notify = vi.fn();
    const adapter = makeAdapter({ actions: { notify, confirm: async () => true } });
    const wrapper = mount(SchemaRenderer, {
      props: {
        page: makePage([{ action: "toast", args: { text: "不该出现" } }]),
        adapter,
        onEvent: (p: UiEventPayload) => p.preventDefault(),
      },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);
    expect(notify).not.toHaveBeenCalled();
  });

  it("返回 false 也能阻断，且 edit 模式不派发", async () => {
    const onEvent = vi.fn(() => false as const);
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage([]), adapter: makeAdapter(), onEvent, mode: "edit" },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("动作参数表达式可引用 $event / $args", async () => {
    const adapter = makeAdapter();
    const wrapper = mount(SchemaRenderer, {
      props: {
        page: makePage([
          { action: "setState", args: { path: "form.picked", value: "{{$event.value.name}}" } },
          { action: "setState", args: { path: "form.index", value: "{{$args[1]}}" } },
        ]),
        adapter,
      },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);
    const scope = (wrapper.vm as unknown as { scope: Record<string, unknown> }).scope;
    expect(scope.form).toMatchObject({ picked: "甲", index: 1 });
  });

  it("adapter.onEvent 可归一化参数，宿主钩子看到改写后的值", async () => {
    const normalize = vi.fn((p: UiEventPayload) => {
      p.args[0] = { id: 7, name: "已归一化" };
    });
    const onEvent = vi.fn();
    const adapter = makeAdapter({ onEvent: normalize });
    const wrapper = mount(SchemaRenderer, {
      props: { page: makePage([]), adapter, onEvent },
      global: { plugins: [ElementPlus] },
    });
    await fire(wrapper);

    expect(normalize).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect((onEvent.mock.calls[0][0] as UiEventPayload).value).toEqual({ id: 7, name: "已归一化" });
  });

  it("表达式求值不污染页面 scope", async () => {
    const scope = { form: { picked: "" } };
    const value = resolveValue("{{$event.value.name}}", {
      ...scope,
      $event: createEventPayload({
        name: "row-click",
        handlerName: "rowClick",
        node: { id: "n1", component: "biz-emitter" },
        page: makePage([]),
        scope,
        args: [{ name: "甲" }],
        actions: [],
      }),
    });
    expect(value).toBe("甲");
    expect(scope).toEqual({ form: { picked: "" } });
  });
});
