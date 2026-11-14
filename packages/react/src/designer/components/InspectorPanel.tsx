/**
 * 右侧检查器：选中节点时是「属性 / 样式 / 校验 / 事件」四个 Tab，
 * 未选中时是「页面设置 / Schema」两个 Tab（Schema 是整页视图，归页面级）。
 * 与 Vue 版 InspectorPanel.vue 功能对齐。
 */
import { useEffect, useState } from "react";
import { effectiveRules } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";
import { PropsEditor } from "./PropsEditor";
import { StyleEditor } from "./StyleEditor";
import { RulesEditor } from "./RulesEditor";
import { EventsEditor } from "./EventsEditor";
import { PageSettings } from "./PageSettings";
import { SchemaViewer } from "./SchemaViewer";

/** 选中节点时的面板：Schema 不放这里，它看的是整页 */
type NodeTabKey = "props" | "style" | "rules" | "events";

const NODE_TABS: Array<{ key: NodeTabKey; label: string }> = [
  { key: "props", label: "属性" },
  { key: "style", label: "样式" },
  { key: "rules", label: "校验" },
  { key: "events", label: "事件" },
];

/** 未选中节点时的面板：页面设置 + 整页 Schema */
type PageTabKey = "settings" | "schema";

const PAGE_TABS: Array<{ key: PageTabKey; label: string }> = [
  { key: "settings", label: "页面设置" },
  { key: "schema", label: "Schema" },
];

export function InspectorPanel() {
  const { store, state, registry } = useDesigner();
  const [nodeTab, setNodeTab] = useState<NodeTabKey>("props");
  const [pageTab, setPageTab] = useState<PageTabKey>("settings");

  const node = state.selectedNode;
  const hasSelection = Boolean(node);
  const material = node ? registry.get(node.component) : undefined;
  /** 只有表单控件才有校验面板 */
  const isField = Boolean(material?.isFormControl);
  const tabEvents = material?.events ?? [];

  const visibleTabs = NODE_TABS.filter((item) => item.key !== "rules" || isField);
  const ruleCount = node
    ? effectiveRules(node, registry.defaults(node.component, node.props)).length
    : 0;
  const breadcrumbText = state.breadcrumb
    .map((item) => registry.get(item.component)?.title ?? item.component)
    .join(" / ");

  // 对齐 Vue 的 watch(hasSelection)：由「无选中」变为「有选中」时回到属性页
  useEffect(() => {
    if (hasSelection) setNodeTab("props");
  }, [hasSelection]);

  // 对齐 Vue 的 watch(isField)：切到非表单控件时，若停在校验页就回属性页。
  // 用函数式更新，依赖不必带上 nodeTab，避免每次切 Tab 都重跑。
  useEffect(() => {
    if (!isField) setNodeTab((prev) => (prev === "rules" ? "props" : prev));
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
                className={`inspector__tab${nodeTab === item.key ? " is-active" : ""}`}
                onClick={() => setNodeTab(item.key)}
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
            {nodeTab === "props" ? (
              <PropsEditor />
            ) : nodeTab === "style" ? (
              <StyleEditor />
            ) : nodeTab === "rules" ? (
              <RulesEditor />
            ) : (
              <EventsEditor />
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
          <div className="inspector__tabs">
            {PAGE_TABS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`inspector__tab${pageTab === item.key ? " is-active" : ""}`}
                onClick={() => setPageTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="inspector__body wb-scroll">
            {pageTab === "settings" ? <PageSettings /> : <SchemaViewer />}
          </div>
          <div className="inspector__footer inspector__footer--tip">
            点击画布中的任意元素以编辑其属性
          </div>
        </>
      )}
    </aside>
  );
}
