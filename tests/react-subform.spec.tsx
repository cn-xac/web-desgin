// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createRef } from "react";
import type { RefObject } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaRenderer } from "@x-ac/web-design-react";
import type { SchemaRendererHandle } from "@x-ac/web-design-react";
import type { NodeSchema, PageSchema } from "@x-ac/web-design-core";

// 覆盖 React 侧的「按组件ID自动绑定」与「子表单（含嵌套）」，与 EP 的 vue 用例对齐。
// 子表单物料 ec-subform、字段控件 input 均来自 core 协议清单（nativeAdapter.materials 已含）。
const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "react_subform",
  type: "page",
  meta: { title: "React 子表单" },
  state: {},
  children: [
    // 1. 自动绑定：不写 modelValue，按 form.n_name 取数
    { id: "n_name", component: "input", props: { label: "姓名" } },

    // 2. 一级子表单：团队成员
    {
      id: "members",
      component: "ec-subform",
      props: { label: "团队成员", itemPath: "members", addText: "添加成员" },
      children: [
        { id: "m_name", component: "input", props: { label: "成员姓名" } },
        { id: "m_role", component: "input", props: { label: "成员角色" } },
      ],
    } as NodeSchema,

    // 3. 嵌套子表单：订单 → 商品明细
    {
      id: "orders",
      component: "ec-subform",
      props: { label: "订单", itemPath: "orders", addText: "添加订单" },
      children: [
        { id: "o_no", component: "input", props: { label: "订单号" } },
        {
          id: "goods",
          component: "ec-subform",
          props: { label: "商品明细", itemPath: "goods", addText: "添加商品" },
          children: [
            { id: "g_name", component: "input", props: { label: "商品名" } },
            { id: "g_qty", component: "input", props: { label: "数量" } },
          ],
        } as NodeSchema,
      ],
    } as NodeSchema,
  ] as NodeSchema[],
};

const seed = {
  form: {
    n_name: "张三",
    members: [{ m_name: "李四", m_role: "开发" }],
    orders: [{ o_no: "A001", goods: [{ g_name: "键盘", g_qty: "2" }] }],
  },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mountRenderer(data?: Record<string, unknown>) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ref = createRef<SchemaRendererHandle>();
  await act(async () => {
    root!.render(<SchemaRenderer ref={ref} page={page} data={data} />);
  });
  return { ref, host: container };
}

function inputs(host: HTMLElement): HTMLInputElement[] {
  return Array.from(host.querySelectorAll("input")) as HTMLInputElement[];
}

describe("React 适配层：子表单与按组件ID自动绑定", () => {
  it("未设置 modelValue 的字段按 form.<id> 自动绑定传入数据", async () => {
    const { host } = await mountRenderer(seed);
    // 第一个 input 是 n_name 的自动绑定（无 modelValue，按 form.n_name 取值）
    expect(inputs(host)[0].value).toBe("张三");
  });

  it("一级子表单渲染已填充的明细组，字段按 form.members[i].<id> 绑定", async () => {
    const { ref } = await mountRenderer(seed);
    const result = ref.current!.getData();
    expect(result.data.form.members).toEqual([{ m_name: "李四", m_role: "开发" }]);
  });

  it("点击添加按钮可新增一组并写入 scope", async () => {
    const { ref, host } = await mountRenderer(seed);
    const addBtns = Array.from(host.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("添加成员"),
    );
    expect(addBtns).toHaveLength(1);

    await act(async () => {
      addBtns[0].click();
    });

    // 点击后 scope 里 members 数组应多一组（原始数据层，未经过滤）
    const members = ((ref.current!.scope as Record<string, Record<string, unknown>[]>).form as Record<string, unknown[]>)
      .members;
    expect(members).toHaveLength(2);
    expect(members[1]).toEqual({ m_name: "", m_role: "" });
  });

  it("嵌套子表单写入 form.orders[i].goods[j]", async () => {
    const { ref } = await mountRenderer(seed);
    const result = ref.current!.getData();
    expect(result.data.form.orders).toEqual([{ o_no: "A001", goods: [{ g_name: "键盘", g_qty: "2" }] }]);
  });
});
