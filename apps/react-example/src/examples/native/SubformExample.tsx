import { useState } from "react";
import { SchemaRenderer } from "@x-ac/design-react";
import { toJSON, validatePage, type NodeSchema, type PageSchema, type UiEventPayload } from "@x-ac/design-core";
import { demoAdapter } from "./materials";

// 一份演示 Schema：覆盖「按组件ID自动绑定」与「子表单（含嵌套）」。
// 关键点：
//  1) 顶层 n_name 不写 modelValue，引擎按 form.n_name 自动取数（来自下方 data seed）。
//  2) 一级子表单 members：每组字段按 form.members[i].<id> 自动绑定。
//  3) 嵌套子表单 orders → goods：内层组路径自动变为 form.orders[i].goods[j].<id>。
// 子表单物料 ec-subform 来自 core 协议清单（nativeAdapter.materials 已含），无需额外注册。
const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "subform-demo",
  type: "page",
  meta: { title: "子表单与自动绑定", device: "pc" },
  state: {},
  children: [
    { id: "h1", component: "native-heading", props: { text: "子表单 & 按组件ID自动绑定", level: 2 } },

    // 1. 自动绑定：不写 modelValue，按 form.n_name 取数
    { id: "n_name", component: "native-input", props: { placeholder: "姓名（自动绑定 form.n_name）" } },

    // 2. 一级子表单：团队成员
    {
      id: "members",
      component: "ec-subform",
      props: { label: "团队成员", itemPath: "members", addText: "添加成员" },
      children: [
        { id: "m_name", component: "native-input", props: { placeholder: "成员姓名" } },
        { id: "m_role", component: "native-input", props: { placeholder: "成员角色" } },
      ],
    } as NodeSchema,

    // 3. 嵌套子表单：订单 → 商品明细
    {
      id: "orders",
      component: "ec-subform",
      props: { label: "订单", itemPath: "orders", addText: "添加订单" },
      children: [
        { id: "o_no", component: "native-input", props: { placeholder: "订单号" } },
        {
          id: "goods",
          component: "ec-subform",
          props: { label: "商品明细", itemPath: "goods", addText: "添加商品" },
          children: [
            { id: "g_name", component: "native-input", props: { placeholder: "商品名" } },
            { id: "g_qty", component: "native-input", props: { placeholder: "数量" } },
          ],
        } as NodeSchema,
      ],
    } as NodeSchema,
  ] as NodeSchema[],
};

// 初始数据：演示自动绑定回填 + 子表单预填一组
const seed: Record<string, unknown> = {
  form: {
    n_name: "张三",
    members: [{ m_name: "李四", m_role: "开发" }],
    orders: [{ o_no: "A001", goods: [{ g_name: "键盘", g_qty: "2" }] }],
  },
};

export function SubformExample() {
  const [data, setData] = useState<Record<string, unknown>>(seed);
  const [issues, setIssues] = useState<string[]>([]);
  const [exported, setExported] = useState("");

  function onNodeEvent(payload: UiEventPayload) {
    if (payload.name === "click" && payload.component === "native-button") {
      setIssues(validatePage(page).issues.map((i) => i.message));
      window.alert(`提交数据：\n${JSON.stringify(data, null, 2)}`);
    }
  }

  return (
    <section className="nx-card">
      <SchemaRenderer
        page={page}
        ui={demoAdapter}
        data={data}
        onDataChange={setData}
        onNodeEvent={onNodeEvent}
      />

      <div className="nx-row">
        <strong>表单数据（data）：</strong>
        <pre className="nx-pre">{JSON.stringify(data, null, 2)}</pre>
      </div>

      <div className="nx-row">
        <button className="nx-btn nx-btn--default" onClick={() => setExported(toJSON(page))}>
          导出 Schema JSON（core.toJSON）
        </button>
        {issues.length > 0 && <span className="nx-warn">校验问题：{issues.join("；")}</span>}
      </div>

      {exported && <pre className="nx-pre">{exported}</pre>}
    </section>
  );
}
