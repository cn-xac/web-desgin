/**
 * 只读的 PageSchema 预览：复制 / 下载当前页面的紧凑 JSON。
 * 与 Vue 版 SchemaViewer.vue 功能对齐。
 */
import { toJSON } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

export function SchemaViewer() {
  const { state, notify } = useDesigner();
  const json = toJSON(state.page);

  const copy = (): void => {
    void navigator.clipboard?.writeText(json);
    notify("Schema 已复制", "success");
  };

  const download = (): void => {
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.page.meta?.title ?? "page"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="schema">
      <div className="schema__bar">
        <span className="schema__title">PageSchema · {json.length} 字符</span>
        <div className="spacer" />
        <UiControl as="Button" size="small" type="text" onClick={copy}>
          复制
        </UiControl>
        <UiControl as="Button" size="small" type="text" onClick={download}>
          下载
        </UiControl>
      </div>
      <pre className="schema__code">{json}</pre>
    </div>
  );
}
