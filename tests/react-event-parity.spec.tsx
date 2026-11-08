// @vitest-environment jsdom
/**
 * React 对齐 Vue 的运行时能力：
 * 事件泛化 + 统一 payload、dataSource、data 双向、submit 出口、
 * 字符串 Schema / 迁移、设备宽度、受控通道与 events.change 共存。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaRenderer, nativeAdapter, registerMaterials } from "@x-ac/design-react";
import type { ControlProps, ReactMaterial, SchemaRendererHandle } from "@x-ac/design-react";
import {
  type ActionSchema,
  type NodeSchema,
  type PageSchema,
  type UiAdapter,
  type UiEventPayload,
} from "@x-ac/design-core";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 同时能派发自定义事件与受控 change 的业务组件 */
function Emitter(props: ControlProps) {
  return (
    <button
      className="biz-emitter"
      onClick={(event) => {
        (props.onRowClick as ((...args: unknown[]) => void) | undefined)?.({ id: 7, name: "甲" }, 1, event);
        (props.onChange as ((...args: unknown[]) => void) | undefined)?.("新值", event);
      }}
    >
      触发行事件
    </button>
  );
}

function makeAdapter(overrides: Partial<UiAdapter<ReactMaterial>> = {}): UiAdapter<ReactMaterial> {
  return registerMaterials<ReactMaterial>(
    {
      ...nativeAdapter,
      actions: { notify: vi.fn(), confirm: async () => true },
      ...overrides,
    },
    [
      {
        component: "biz-emitter",
        title: "事件发射器",
        impl: Emitter,
        isFormControl: true,
        events: [{ name: "row-click", title: "行点击" }],
      },
    ],
  );
}

function makePage(
  actions: ActionSchema[],
  state: Record<string, unknown> = { form: { picked: "", name: "" }, list: [] },
): PageSchema {
  const node: NodeSchema = {
    id: "r_emit",
    component: "biz-emitter",
    props: { modelValue: "{{form.name}}" },
    events: { "row-click": actions },
  };
  return {
    schemaVersion: "1.0.0",
    id: "react_event",
    type: "page",
    meta: { title: "事件测试", device: "pc" },
    state,
    children: [node],
  };
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(element: ReactElement): void {
  act(() => root.render(element));
}

async function clickEmitter(): Promise<void> {
  const button = container.querySelector("button.biz-emitter");
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("React 事件回调（与 Vue 同形状）", () => {
  it("任意事件名 + 完整 payload：节点 / 物料 / scope / 原始参数", async () => {
    const onEvent = vi.fn();
    render(<SchemaRenderer page={makePage([])} ui={makeAdapter()} onEvent={onEvent} />);
    await clickEmitter();

    expect(onEvent).toHaveBeenCalledTimes(1);
    const payload = onEvent.mock.calls[0][0] as UiEventPayload;
    expect(payload.name).toBe("row-click");
    expect(payload.handlerName).toBe("onRowClick");
    expect(payload.nodeId).toBe("r_emit");
    expect(payload.component).toBe("biz-emitter");
    expect(payload.material?.title).toBe("事件发射器");
    expect(payload.page.id).toBe("react_event");
    expect(payload.scope).toHaveProperty("form");
    expect(payload.value).toEqual({ id: 7, name: "甲" });
    expect(payload.args[1]).toBe(1);
    expect(payload.nativeEvent).toBeTruthy();
  });

  it("preventDefault 阻断预设动作", async () => {
    const notify = vi.fn();
    const ui = makeAdapter({ actions: { notify, confirm: async () => true } });
    render(
      <SchemaRenderer
        page={makePage([{ action: "toast", args: { text: "不该出现" } }])}
        ui={ui}
        onEvent={(p: UiEventPayload) => p.preventDefault()}
      />,
    );
    await clickEmitter();
    expect(notify).not.toHaveBeenCalled();
  });

  it("返回 false 也能阻断；edit 模式不派发", async () => {
    const onEvent = vi.fn(() => false as const);
    render(<SchemaRenderer page={makePage([])} ui={makeAdapter()} onEvent={onEvent} mode="edit" />);
    await clickEmitter();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("动作参数表达式可引用 $event / $args", async () => {
    const ref = createRef<SchemaRendererHandle>();
    render(
      <SchemaRenderer
        ref={ref}
        page={makePage([
          { action: "setState", args: { path: "form.picked", value: "{{$event.value.name}}" } },
          { action: "setState", args: { path: "form.index", value: "{{$args[1]}}" } },
        ])}
        ui={makeAdapter()}
      />,
    );
    await clickEmitter();
    expect(ref.current?.scope.form).toMatchObject({ picked: "甲", index: 1 });
  });

  it("adapter.onEvent 归一化后宿主钩子看到改写值", async () => {
    const normalize = vi.fn((p: UiEventPayload) => {
      p.args[0] = { id: 7, name: "已归一化" };
    });
    const onEvent = vi.fn();
    render(<SchemaRenderer page={makePage([])} ui={makeAdapter({ onEvent: normalize })} onEvent={onEvent} />);
    await clickEmitter();
    expect(normalize).toHaveBeenCalledTimes(1);
    expect((onEvent.mock.calls[0][0] as UiEventPayload).value).toEqual({ id: 7, name: "已归一化" });
  });

  it("受控通道与 events.change 共存：先写状态，再跑动作", async () => {
    const ref = createRef<SchemaRendererHandle>();
    const page = makePage([]);
    page.children[0].events = {
      ...page.children[0].events,
      change: [{ action: "setState", args: { path: "form.flag", value: "changed" } }],
    };
    render(<SchemaRenderer ref={ref} page={page} ui={makeAdapter()} />);
    await clickEmitter();
    expect(ref.current?.scope.form).toMatchObject({ name: "新值", flag: "changed" });
  });
});

describe("React 渲染器能力对齐", () => {
  it("dataSource.http 自动取数并进入表达式", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ name: "远端" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const page = makePage([]);
    page.dataSource = { remote: { type: "http", url: "/api/user" } };
    page.children.push({ id: "r_remote", component: "text", props: { text: "{{remote.name}}" } });

    await act(async () => {
      root.render(<SchemaRenderer page={page} ui={makeAdapter()} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/user", expect.objectContaining({ method: "GET" }));
    expect(container.textContent).toContain("远端");
  });

  it("dataSource.static 直接写入 scope", async () => {
    const page = makePage([]);
    page.dataSource = { cfg: { type: "static", data: { label: "静态配置" } } };
    page.children.push({ id: "r_cfg", component: "text", props: { text: "{{cfg.label}}" } });
    await act(async () => {
      root.render(<SchemaRenderer page={page} ui={makeAdapter()} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("静态配置");
  });

  it("submitForm 通过 onSubmit 抛给宿主", async () => {
    const onSubmit = vi.fn();
    const page = makePage([{ action: "submitForm", args: { from: "form", to: "list", validate: false } }]);
    render(<SchemaRenderer page={page} ui={makeAdapter()} onSubmit={onSubmit} />);
    await clickEmitter();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ picked: "", name: "" });
  });

  it("data 作为初始 seed，scope 变化回传 onDataChange", async () => {
    const onDataChange = vi.fn();
    render(
      <SchemaRenderer
        page={makePage([])}
        ui={makeAdapter()}
        data={{ form: { picked: "外部", name: "外" }, list: [] }}
        onDataChange={onDataChange}
      />,
    );
    expect(container.textContent).toContain("触发行事件");

    await clickEmitter();
    expect(onDataChange).toHaveBeenCalled();
    const last = onDataChange.mock.calls[onDataChange.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(last.form).toMatchObject({ name: "新值" });
  });

  it("字符串 Schema 自动解析并按 device 设置宽度", () => {
    const page = makePage([]);
    page.meta = { title: "H5", device: "h5" };
    render(<SchemaRenderer page={JSON.stringify(page)} ui={makeAdapter()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.maxWidth).toBe("420px");
    expect(container.textContent).toContain("触发行事件");
  });

  it("ref API 补上 setData / exportData / reload", () => {
    const ref = createRef<SchemaRendererHandle>();
    render(<SchemaRenderer ref={ref} page={makePage([])} ui={makeAdapter()} />);
    expect(typeof ref.current?.setData).toBe("function");
    expect(typeof ref.current?.exportData).toBe("function");
    expect(typeof ref.current?.reload).toBe("function");
    act(() => ref.current?.setData({ extra: 1 }));
    expect(ref.current?.scope.extra).toBe(1);
  });
});
