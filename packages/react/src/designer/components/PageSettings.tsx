/**
 * 页面设置：标题 / 设备 / 页面 ID，以及 state 与 dataSource 两段 JSON 编辑。
 * 与 Vue 版 PageSettings.vue 功能对齐，差异只在受控通道 value / onChange。
 */
import { useEffect, useState } from "react";
import type { DeviceType, PageSchema } from "@x-ac/design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

/** 设备档位：标签里带上画布宽度，选的时候不用回忆数值 */
const DEVICE_OPTIONS: Array<{ label: string; value: DeviceType }> = [
  { label: "PC · 960", value: "pc" },
  { label: "Pad · 768", value: "pad" },
  { label: "H5 · 420", value: "h5" },
];

export function PageSettings() {
  const { store, state, notify } = useDesigner();
  const page = state.page;

  // 两段 JSON 用本地 state 暂存草稿；只有点「应用」才写回 store
  const [stateText, setStateText] = useState(() => JSON.stringify(page.state ?? {}, null, 2));
  const [dataSourceText, setDataSourceText] = useState(() =>
    JSON.stringify(page.dataSource ?? {}, null, 2),
  );
  const [stateError, setStateError] = useState("");
  const [dataSourceError, setDataSourceError] = useState("");

  // 只在「换页」时按新快照重置草稿：依赖刻意只放 id。
  // 若监听整个 page，每次按键引起的快照更新都会把用户正在输入的内容覆盖掉。
  useEffect(() => {
    setStateText(JSON.stringify(state.page.state ?? {}, null, 2));
    setDataSourceText(JSON.stringify(state.page.dataSource ?? {}, null, 2));
    setStateError("");
    setDataSourceError("");
  }, [state.page.id]);

  const dataSourceEntries = Object.entries(page.dataSource ?? {});

  const applyState = (): void => {
    try {
      const parsed: unknown = JSON.parse(stateText || "{}");
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("state 必须是对象");
      }
      store.patchPage({ state: parsed as Record<string, unknown> });
      setStateError("");
      notify("页面状态已更新", "success");
    } catch (error) {
      setStateError((error as Error).message);
    }
  };

  const applyDataSource = (): void => {
    try {
      const parsed: unknown = JSON.parse(dataSourceText || "{}");
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("dataSource 必须是对象");
      }
      store.patchPage({ dataSource: parsed as PageSchema["dataSource"] });
      setDataSourceError("");
      notify("数据源已更新", "success");
    } catch (error) {
      setDataSourceError((error as Error).message);
    }
  };

  return (
    <div className="settings">
      <div className="settings__section">页面</div>
      <div className="settings__row">
        <label>标题</label>
        <UiControl
          as="Input"
          size="small"
          value={String(page.meta?.title ?? "")}
          onChange={(value: unknown) => store.setTitle(String(value))}
        />
      </div>
      <div className="settings__row">
        <label>设备</label>
        <UiControl
          as="Select"
          size="small"
          value={(page.meta?.device ?? "pc") as DeviceType}
          options={DEVICE_OPTIONS}
          onChange={(value: unknown) => store.setDevice(String(value) as DeviceType)}
        />
      </div>
      <div className="settings__row">
        <label>页面 ID</label>
        <span className="settings__mono">{page.id}</span>
      </div>

      <div className="settings__section">
        页面状态 state
        <span className="settings__hint">渲染时注入 scope，供双花括号表达式取值</span>
      </div>
      <UiControl
        as="Input"
        className="settings__code"
        size="small"
        rows={8}
        value={stateText}
        onChange={(value: unknown) => setStateText(String(value ?? ""))}
      />
      {stateError ? <div className="settings__error">{stateError}</div> : null}
      <UiControl as="Button" size="small" type="primary" plain onClick={applyState}>
        应用状态
      </UiControl>

      <div className="settings__section">
        数据源 dataSource
        <span className="settings__hint">{dataSourceEntries.length} 项</span>
      </div>
      <UiControl
        as="Input"
        className="settings__code"
        size="small"
        rows={6}
        value={dataSourceText}
        onChange={(value: unknown) => setDataSourceText(String(value ?? ""))}
      />
      {dataSourceError ? <div className="settings__error">{dataSourceError}</div> : null}
      <UiControl as="Button" size="small" type="primary" plain onClick={applyDataSource}>
        应用数据源
      </UiControl>

      <div className="settings__tip">
        支持 <code>{'{"type":"static","data":{...}}'}</code> 与{" "}
        <code>{'{"type":"http","url":"/api/list","auto":true}'}</code> 两种声明式取数。
      </div>
    </div>
  );
}
