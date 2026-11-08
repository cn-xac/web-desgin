/**
 * 右侧检查器：选中节点时是「属性 / 样式 / 校验 / 事件 / Schema」五个 Tab，
 * 未选中时退化为页面设置。与 Vue 版 InspectorPanel.vue 功能对齐。
 */
import { useEffect, useState } from "react";
import { effectiveRules } from "@x-ac/design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";
import { PropsEditor } from "./PropsEditor";
import { StyleEditor } from "./StyleEditor";
import { RulesEditor } from "./RulesEditor";
import { EventsEditor } from "./EventsEditor";
import { PageSettings } from "./PageSettings";
import { SchemaViewer } from "./SchemaViewer";

type TabKey = "props" | "style" | "rules" | "events" | "schema";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "props", label: "属性" },
  { key: "style", label: "样式" },
  { key: "rules", label: "校验" },
  { key: "events", label: "事件" },
  { key: "schema", label: "Schema" },
];

export function InspectorPanel() {
  const { store, state, registry } = useDesigner();
  const [tab, setTab] = useState<TabKey>("props");

  const node = state.selectedNode;
  const hasSelection = Boolean(node);
  const material = node ? registry.get(node.component) : undefined;
  /** 只有表单控件才有校验面板 */
  const isField = Boolean(material?.isFormControl);
  const tabEvents = material?.events ?? [];

  const visibleTabs = TABS.filter((item) => item.key !== "rules" || isField);
  const ruleCount = node
    ? effectiveRules(node, registry.defaults(node.component, node.props)).length
    : 0;
  const breadcrumbText = state.breadcrumb
    .map((item) => registry.get(item.component)?.title ?? item.component)
    .join(" / ");

  // 对齐 Vue 的 watch(hasSelection)：由「无选中」变为「有选中」时回到属性页；
  // 变为无选中且正停在 Schema 页时也回属性页，避免下次选中直接落在 Schema 上。
  useEffect(() => {
    if (hasSelection) setTab("props");
    else setTab((prev) => (prev === "schema" ? "props" : prev));
  }, [hasSelection]);

  // 对齐 Vue 的 watch(isField)：切到非表单控件时，若停在校验页就回属性页。
  // 用函数式更新，依赖不必带上 tab，避免每次切 Tab 都重跑。
  useEffect(() => {
    if (!isField) setTab((prev) => (prev === "rules" ? "props" : prev));
  }, [isField]);

  return (
    <aside className="inspector">
      {hasSelection ? (
        <>
          <div className="inspector__crumbs" title={breadcrumbText}>
            {breadcrumbText}
          </div>
          <div className="inspector__tabs">
            {visibleTabs.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`inspector__tab${tab === item.key ? " is-active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                {item.label}
                {item.key === "rules" && ruleCount ? (
                  <span className="inspector__count">{ruleCount}</span>
                ) : item.key === "events" && tabEvents.length ? (
                  <span className="inspector__count">{tabEvents.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="inspector__body wb-scroll">
            {tab === "props" ? (
              <PropsEditor />
            ) : tab === "style" ? (
              <StyleEditor />
            ) : tab === "rules" ? (
              <RulesEditor />
            ) : tab === "events" ? (
              <EventsEditor />
            ) : (
              <SchemaViewer />
            )}
          </div>

          <div className="inspector__footer">
            <UiControl as="Button" size="small" onClick={() => store.moveSelected(-1)}>
              上移
            </UiControl>
            <UiControl as="Button" size="small" onClick={() => store.moveSelected(1)}>
              下移
            </UiControl>
            <UiControl as="Button" size="small" onClick={() => store.duplicateSelected()}>
              复制
            </UiControl>
            <UiControl
              as="Button"
              size="small"
              type="danger"
              plain
              onClick={() => store.removeSelected()}
            >
              删除
            </UiControl>
          </div>
        </>
      ) : (
        <>
          <div className="inspector__tabs inspector__tabs--single">
            <button type="button" className="inspector__tab is-active">
              页面设置
            </button>
          </div>
          <div className="inspector__body wb-scroll">
            <PageSettings />
          </div>
          <div className="inspector__footer inspector__footer--tip">
            点击画布中的任意元素以编辑其属性
          </div>
        </>
      )}
    </aside>
  );
}
