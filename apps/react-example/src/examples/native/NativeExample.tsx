import { useState } from "react";
import { SchemaRenderer } from "@x-ac/web-design-react";
import { toJSON, validatePage, type NodeSchema, type PageSchema, type UiEventPayload } from "@x-ac/web-design-core";
import { demoAdapter } from "./materials";

// 一份最小 PageSchema：标题 + 输入（modelValue 表达式绑定到 data.name）+ 按钮。
const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "demo-page",
  type: "page",
  meta: { title: "原生组件示例", device: "pc" },
  state: {},
  children: [
    { id: "h1", component: "native-heading", props: { text: "原生组件示例", level: 2 } },
    { id: "name", component: "native-input", props: { placeholder: "请输入姓名", modelValue: "{{name}}" } },
    { id: "btn", component: "native-button", props: { label: "提交", type: "primary" }, events: { click: [] } },
  ] as NodeSchema[],
};

export function NativeExample() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [exported, setExported] = useState("");

  // node-event：只读通知，拿到完整 UiEventPayload（事件名 name、节点 node、物料、scope…）。
  function onNodeEvent(payload: UiEventPayload) {
    if (payload.name === "click" && payload.component === "native-button") {
      setIssues(validatePage(page).issues.map((i) => i.message));
      window.alert(`提交数据：\n${JSON.stringify(data, null, 2)}`);
    }
  }

  return (
    <section className="nx-card">
      {/* ui 传适配包；data + onDataChange 实现外部数据双向同步 */}
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
