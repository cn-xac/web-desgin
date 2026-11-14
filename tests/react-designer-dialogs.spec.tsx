// @vitest-environment jsdom
/**
 * React 设计器弹窗：与 Vue 侧 designer-bindings.spec.ts 对齐的端到端验证。
 *
 * 覆盖 Vue 已验收的六个设计器弹窗入口：
 * - 绑定数据选择器（ruUqAF）：列出可绑定数据 → 点一条即完成绑定 / 可清除；
 * - 选项录入弹窗（rSulo9）：一行一选项，名称在前值在后；支持选项数据源；
 * - 外部数据源弹窗（rg4KCt）：写页面级 externalSources，节点只留 externalRef；
 * - 不可变元素禁用外部数据源；
 * - 请求头弹窗：确认覆盖 / 取消保留；
 * - 子映射（目标为子表单）；
 * - 显示隐藏条件弹窗；
 * - 问号提示浮层挂到 body。
 *
 * 用例不依赖适配包：直接往仓储里放 Schema 再点画布节点选中，
 * 这样 CI（无适配包）与本地（真实扩展仓）跑的是同一套断言。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createRef } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { SchemaDesigner } from "@x-ac/web-design-react/designer";
import type { SchemaDesignerHandle } from "@x-ac/web-design-react/designer";
import { NativeTooltip } from "@x-ac/web-design-react/designer";
import { ReactDesignProvider } from "@x-ac/web-design-react";
import { createDesignerKit, defineReactAdapter } from "@x-ac/web-design-react/kit";
import type { DesignerControlProps } from "@x-ac/web-design-react/designer";
import { createEmptyPage, createMemoryRepository, MATERIALS } from "@x-ac/web-design-core";
import type { NodeSchema, PageRepository, PageSchema, UiAdapter } from "@x-ac/web-design-core";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => undefined;
  }
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  document.querySelectorAll(".wbd-toast").forEach((element) => element.remove());
  document.querySelectorAll(".wbd-tip__pop").forEach((element) => element.remove());
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 建一个只含一个节点的页面：用仓储喂给设计器，避免依赖物料面板 */
function pageWith(children: NodeSchema[], extra: Partial<PageSchema> = {}): PageSchema {
  return { ...createEmptyPage("弹窗测试"), id: "p1", children, ...extra };
}

function setup(page: PageSchema, adapter?: UiAdapter<never>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const repo: PageRepository = createMemoryRepository([page]);
  const ref = createRef<SchemaDesignerHandle>();

  const render = async (): Promise<void> => {
    const designer = <SchemaDesigner pageId="p1" repository={repo} ref={ref} />;
    const element: ReactElement = adapter ? (
      <ReactDesignProvider adapter={adapter as never}>{designer}</ReactDesignProvider>
    ) : (
      designer
    );
    await act(async () => {
      root.render(element);
    });
  };
  const cleanup = async (): Promise<void> => {
    await act(async () => root.unmount());
    container.remove();
  };
  /** 选中画布上的节点（设计器没有对外暴露 store，走真实交互） */
  const select = async (nodeId: string): Promise<void> => {
    const node = container.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!node) throw new Error(`画布上找不到节点 ${nodeId}`);
    await act(async () => node.click());
  };
  /** 当前 Schema（未保存也能拿到，用于断言弹窗的写回结果） */
  const schema = (): PageSchema => JSON.parse(ref.current!.exportSchema()) as PageSchema;
  const nodeOf = (nodeId: string): NodeSchema | undefined =>
    schema().children.find((node) => node.id === nodeId);
  return { container, repo, ref, render, cleanup, select, schema, nodeOf };
}

const byText = (container: HTMLElement, selector: string, text: string): HTMLElement | undefined =>
  [...container.querySelectorAll<HTMLElement>(selector)].find((element) =>
    (element.textContent ?? "").includes(text),
  );

/** 受控输入框写值：必须走原型 setter + input 事件，React 才认 */
async function typeInto(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const click = async (element: Element | null | undefined): Promise<void> => {
  if (!element) throw new Error("要点击的元素不存在");
  await act(async () => (element as HTMLElement).click());
};

describe("React 设计器：绑定数据选择器", () => {
  it("列出可绑定数据，点一条即完成 {{}} 绑定", async () => {
    const ui = setup(pageWith([{ id: "f1", component: "input", props: { label: "姓名" } }]));
    try {
      await ui.render();
      await ui.select("f1");

      const link = ui.container.querySelector(".props__link");
      expect(link).toBeTruthy();
      await click(link);

      expect(ui.container.querySelector(".wbd-modal__title")?.textContent).toContain("选择可绑定数据");
      const items = ui.container.querySelectorAll(".picker__item");
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].textContent).toContain("form.f1");

      await click(items[0]);

      const node = ui.nodeOf("f1");
      const bound = Object.values(node?.props ?? {}).find((value) => String(value).includes("{{"));
      expect(String(bound)).toMatch(/^\{\{.+\}\}$/);
      expect(ui.container.querySelector(".wbd-modal__title")).toBeNull();
    } finally {
      await ui.cleanup();
    }
  });

  it("已绑定的属性可清除绑定", async () => {
    const ui = setup(pageWith([{ id: "f1", component: "input", props: { label: "姓名" } }]));
    try {
      await ui.render();
      await ui.select("f1");

      await click(ui.container.querySelector(".props__link"));
      await click(ui.container.querySelector(".picker__item"));

      // 再打开一次，这次点「清除绑定」
      await click(ui.container.querySelector(".props__link"));
      const unbind = byText(ui.container, ".picker__unbind", "清除绑定");
      expect(unbind).toBeTruthy();
      await click(unbind);

      const node = ui.nodeOf("f1");
      expect(Object.values(node?.props ?? {}).some((value) => String(value).includes("{{"))).toBe(false);
    } finally {
      await ui.cleanup();
    }
  });
});

describe("React 设计器：选项录入弹窗", () => {
  it("独立弹窗录入「一行一选项、名称在前值在后」，并写回 Schema", async () => {
    const ui = setup(pageWith([{ id: "r1", component: "radio", props: { label: "部门" } }]));
    try {
      await ui.render();
      await ui.select("r1");

      const entry = ui.container.querySelector(".props__options-btn");
      expect(entry).toBeTruthy();
      await click(entry);

      expect(ui.container.querySelector(".wbd-modal__title")?.textContent).toContain("编辑");

      const textarea = ui.container.querySelector(".opts__text") as HTMLTextAreaElement | null;
      expect(textarea).toBeTruthy();
      await typeInto(textarea!, "技术中心 tech\n产品中心 product");

      const preview = ui.container.querySelectorAll(".opts__preview-row");
      expect(preview).toHaveLength(2);
      expect(preview[0].textContent).toContain("技术中心");
      expect(preview[0].textContent).toContain("tech");

      await click(ui.container.querySelector(".opts__ok"));
      expect(String(ui.nodeOf("r1")?.props?.options)).toBe("技术中心 tech\n产品中心 product");
    } finally {
      await ui.cleanup();
    }
  });

  it("选项数据源：配置后 options 自动绑到结果路径，配置写页面级 externalSources", async () => {
    const ui = setup(pageWith([{ id: "r1", component: "radio", props: { label: "部门" } }]));
    try {
      await ui.render();
      await ui.select("r1");
      await click(ui.container.querySelector(".props__options-btn"));

      await click(ui.container.querySelector(".opts__source-switch input"));
      const url = ui.container.querySelector('input[placeholder="/api/dict/list"]') as HTMLInputElement;
      expect(url).toBeTruthy();
      await typeInto(url, "/api/org/list");
      await click(ui.container.querySelector(".opts__ok"));

      const node = ui.nodeOf("r1");
      expect(String(node?.props?.options)).toBe("{{options.r1}}");
      const ref = node?.externalRef;
      expect(ref).toBeTruthy();
      const source = ui.schema().externalSources?.[ref!];
      expect(source?.url).toBe("/api/org/list");
      expect(source?.asOptions).toBe(true);
    } finally {
      await ui.cleanup();
    }
  });
});

describe("React 设计器：外部数据源弹窗", () => {
  /**
   * 元素下拉的「可搜索」开关：引擎负责把 filterable 透传给设计器控件，
   * 真正的搜索能力由适配包接（antd → showSearch / EP → filterable）。
   * 用探针适配包记录收到的 props，锁住这条接线，避免引擎侧悄悄断链。
   */
  it("元素下拉把 filterable 透传给设计器控件", async () => {
    const seen: DesignerControlProps[] = [];

    function ProbeSelect(props: DesignerControlProps) {
      seen.push(props);
      const list = (props.options ?? []).map((item) =>
        typeof item === "object" && item !== null && "label" in item
          ? { label: String(item.label), value: String(item.value) }
          : { label: String(item), value: String(item) },
      );
      return (
        <select
          className="probe-select"
          value={props.value === undefined || props.value === null ? "" : String(props.value)}
          onChange={(event) => props.onChange?.(event.target.value)}
        >
          {list.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    const adapter = defineReactAdapter({
      name: "probe",
      components: {},
      materials: MATERIALS,
      designer: createDesignerKit({ Select: ProbeSelect }),
    });

    const ui = setup(
      pageWith([{ id: "s1", component: "select", props: { label: "部门" } }]),
      adapter as never,
    );
    try {
      await ui.render();
      await ui.select("s1");
      await click(ui.container.querySelector(".props__ext"));

      // 参数映射 / 响应映射默认都是空的，各加一行才会渲染出「选元素」下拉
      await click(byText(ui.container, ".ext__ghost", "添加参数"));
      await click(byText(ui.container, ".ext__ghost", "添加响应映射"));

      // 请求方法 / 顶栏设备下拉不需要搜索；凡是「选元素」的下拉都必须带 filterable
      const valueOf = (item: unknown): string =>
        String((item as { value?: unknown } | null)?.value ?? item ?? "");
      const elementPickers = seen.filter((props) =>
        (props.options ?? []).some((item) => valueOf(item).startsWith("form.")),
      );
      expect(elementPickers.length).toBeGreaterThanOrEqual(2);
      expect(elementPickers.every((props) => props.filterable === true)).toBe(true);
    } finally {
      await ui.cleanup();
    }
  });

  it("配置后写进页面级 externalSources，节点只留 externalRef", async () => {
    const ui = setup(pageWith([{ id: "s1", component: "select", props: { label: "部门" } }]));
    try {
      await ui.render();
      await ui.select("s1");
      await click(ui.container.querySelector(".props__ext"));

      expect(ui.container.querySelector(".wbd-modal__title")?.textContent).toContain("外部数据源");
      // 触发元素是只读展示，弹窗不再提供触发元素选择
      expect(ui.container.querySelector(".ext__static")).toBeTruthy();
      expect(ui.container.textContent).not.toContain("触发字段");

      await typeInto(ui.container.querySelector('input[placeholder="/api/dept/list"]') as HTMLInputElement, "/api/dept/list");
      await typeInto(ui.container.querySelector('input[placeholder="如 部门列表"]') as HTMLInputElement, "部门列表");
      await click(ui.container.querySelector(".ext__ok"));

      const node = ui.nodeOf("s1");
      expect(node?.externalRef).toBeTruthy();
      const source = ui.schema().externalSources?.[node!.externalRef!];
      expect(source?.url).toBe("/api/dept/list");
      expect(source?.name).toBe("部门列表");
      // 缺省「只请求一次」
      expect(source?.once).toBe(true);
    } finally {
      await ui.cleanup();
    }
  });

  it("移除数据源会清掉节点上的配置", async () => {
    const ui = setup(pageWith([{ id: "s1", component: "select", props: { label: "部门" } }]));
    try {
      await ui.render();
      await ui.select("s1");

      await click(ui.container.querySelector(".props__ext"));
      await typeInto(ui.container.querySelector('input[placeholder="/api/dept/list"]') as HTMLInputElement, "/api/dept/list");
      await click(ui.container.querySelector(".ext__ok"));
      expect(Object.keys(ui.schema().externalSources ?? {}).length).toBe(1);

      await click(ui.container.querySelector(".props__ext"));
      await click(ui.container.querySelector(".ext__remove"));

      expect(ui.nodeOf("s1")?.externalRef).toBeUndefined();
      expect(Object.keys(ui.schema().externalSources ?? {}).length).toBe(0);
    } finally {
      await ui.cleanup();
    }
  });

  it("内容不可被用户改变的元素不能添加外部数据源", async () => {
    const ui = setup(pageWith([{ id: "t1", component: "text", props: { text: "说明文字" } }]));
    try {
      await ui.render();
      await ui.select("t1");

      const button = ui.container.querySelector(".props__ext");
      expect(button).toBeTruthy();
      // 弱禁用：按钮仍可见，但标成不可用
      expect(button!.classList.contains("is-disabled")).toBe(true);

      await click(button);

      expect(ui.container.querySelector(".wbd-modal__title")).toBeNull();
      expect(ui.nodeOf("t1")?.externalRef).toBeUndefined();
      expect(Object.keys(ui.schema().externalSources ?? {}).length).toBe(0);
    } finally {
      await ui.cleanup();
    }
  });

  it("请求头：确认写入、删除后再次打开不再存在", async () => {
    const ui = setup(pageWith([{ id: "i1", component: "input", props: { label: "姓名" } }]));
    try {
      await ui.render();
      await ui.select("i1");
      await click(ui.container.querySelector(".props__ext"));
      await typeInto(ui.container.querySelector('input[placeholder="/api/dept/list"]') as HTMLInputElement, "/api/dept/list");

      const headersButton = (): HTMLElement | undefined => byText(ui.container, ".ext__ghost", "请求头");
      await click(headersButton());

      await click(ui.container.querySelector(".hdr__add"));
      await typeInto(
        ui.container.querySelector('input[placeholder="名称，如 Authorization"]') as HTMLInputElement,
        "X-Token",
      );
      await typeInto(ui.container.querySelector('input[placeholder="取值"]') as HTMLInputElement, "abc");
      await click(ui.container.querySelector(".hdr__ok"));
      expect(headersButton()?.textContent).toContain("已设置 1 个请求头");

      // 再打开并删掉这一条
      await click(headersButton());
      await click(ui.container.querySelector(".hdr__del"));
      await click(ui.container.querySelector(".hdr__ok"));
      expect(headersButton()?.textContent).toContain("设置请求头");
      expect(headersButton()?.textContent).not.toContain("已设置");

      await click(ui.container.querySelector(".ext__ok"));
      const node = ui.nodeOf("i1");
      const source = ui.schema().externalSources?.[node?.externalRef ?? ""];
      expect(source?.headers).toBeUndefined();
    } finally {
      await ui.cleanup();
    }
  });

  it("目标为子表单时出现父字段名与子映射入口，子映射列出子表单字段", async () => {
    const ui = setup(
      pageWith(
        [
          { id: "i1", component: "input", props: { label: "姓名" }, externalRef: "ext_1" },
          {
            id: "sf1",
            component: "ec-subform",
            props: { label: "明细", itemPath: "items" },
            children: [{ id: "g1", component: "ec-input", props: { label: "商品" } }],
          },
        ],
        {
          externalSources: {
            ext_1: {
              id: "ext_1",
              url: "/api/rows",
              responses: [{ scopePath: "form.items", shape: "form", parentField: "items" }],
            },
          },
        },
      ),
    );
    try {
      await ui.render();
      await ui.select("i1");
      await click(ui.container.querySelector(".props__ext"));

      const resp = ui.container.querySelector(".ext__resp");
      expect(resp?.textContent).toContain("父字段名");
      expect(resp?.textContent).toContain("设置子映射");

      await click(byText(ui.container, ".ext__ghost", "设置子映射"));
      const titles = [...ui.container.querySelectorAll(".wbd-modal__title")].map((item) => item.textContent ?? "");
      expect(titles.some((text) => text.includes("子映射"))).toBe(true);
      // 说明图标 + 说明项
      expect(ui.container.querySelector(".sub__tip .wbd-tip__trigger")).toBeTruthy();

      const row = ui.container.querySelector(".sub__row");
      expect(row?.textContent).toContain("商品");

      await typeInto(ui.container.querySelector(".sub__input") as HTMLInputElement, "goodsName");
      await click(ui.container.querySelector(".sub__ok"));

      // 回到主弹窗：子映射计数已更新
      expect(byText(ui.container, ".ext__ghost", "已配置 1 项")).toBeTruthy();
    } finally {
      await ui.cleanup();
    }
  });
});

describe("React 设计器：显示隐藏条件弹窗", () => {
  it("配置一条显示条件后写进 node.visibility", async () => {
    const ui = setup(
      pageWith([
        { id: "i1", component: "input", props: { label: "姓名" } },
        // 条件源不能是元素自己，所以页面上要有第二个可引用元素
        { id: "f2", component: "input", props: { label: "部门" } },
      ]),
    );
    try {
      await ui.render();
      await ui.select("i1");

      await click(byText(ui.container, ".inspector__tab", "样式"));
      const trigger = byText(ui.container, ".style__cond-btn", "未配置");
      expect(trigger).toBeTruthy();
      await click(trigger);

      expect(ui.container.querySelector(".wbd-modal__title")?.textContent).toBe("配置显示条件");

      const left = ui.container.querySelector(".cond__left") as HTMLSelectElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      await act(async () => {
        setter.call(left, "form.f2");
        left.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await typeInto(ui.container.querySelector(".cond__value") as HTMLInputElement, "张三");
      await click(ui.container.querySelector(".cond__ok"));

      const visibility = ui.nodeOf("i1")?.visibility;
      expect(visibility?.show?.rows).toHaveLength(1);
      expect(visibility?.show?.rows[0]).toMatchObject({ left: "form.f2", operator: "eq", value: "张三" });
    } finally {
      await ui.cleanup();
    }
  });
});

describe("React 设计器：问号提示浮层", () => {
  it("弹层挂到 body，不会被弹窗的 overflow 裁剪", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <NativeTooltip text="说明文案">
            <button className="trg">?</button>
          </NativeTooltip>,
        );
      });

      const trigger = container.querySelector(".wbd-tip");
      await act(async () => {
        trigger!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });

      const pop = document.body.querySelector(".wbd-tip__pop");
      expect(pop).toBeTruthy();
      expect(pop?.textContent).toContain("说明文案");
      // 触发点在组件内、弹层在 body 上 → 不受任何 overflow 容器裁剪
      expect(container.contains(pop)).toBe(false);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
