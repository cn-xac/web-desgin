/**
 * React 可视化设计器（对齐 Vue 的 SchemaDesigner / DesignerView）。
 *
 * 标签即用：
 *   <SchemaDesigner pageId="p1" onSaved={...} ref={ref} />
 *   import { SchemaDesigner } from "@x-ac/web-design-react/designer";
 *
 * 状态机来自 core 的 DesignerStore，与 Vue 设计器完全同源；本组件只负责
 * React 的订阅（useSyncExternalStore）、快捷键、文件导入导出与布局。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChangeEvent } from "react";
import {
  DesignerStore,
  MATERIALS,
  createRegistry,
  migratePage,
  toHtml,
  validatePage,
} from "@x-ac/web-design-core";
import type { DeviceType, PageRepository, PageSchema } from "@x-ac/web-design-core";
import { useUiAdapter } from "../provider";
import { DesignerContext } from "./context";
import type { DesignerContextValue } from "./context";
import { resolveDesignerUi, resolveNotify, UiControl } from "./ui";
import { PalettePanel } from "./components/PalettePanel";
import { OutlinePanel } from "./components/OutlinePanel";
import { CanvasStage } from "./components/CanvasStage";
import { InspectorPanel } from "./components/InspectorPanel";

export interface SchemaDesignerProps {
  /** 页面 id，由宿主传入；切换 id 会重新从仓储载入 */
  pageId: string;
  /** 组件级页面仓储；不传用全局 setPageRepository 注入的那份 */
  repository?: PageRepository;
  /** 预览地址构造函数，设计器直接打开新窗口 */
  previewUrl?: (id: string) => string;
  /** 动作里的「页面跳转」交给宿主 */
  navigate?: (to: string) => void;
  onBack?: () => void;
  onPreview?: (id: string) => void;
  onSaved?: (id: string) => void;
  /** 工具栏导出 JSON / HTML 时同步抛出，宿主可归档 */
  onExportSchema?: (payload: { kind: "json" | "html"; content: string; schema: PageSchema }) => void;
}

export interface SchemaDesignerHandle {
  exportSchema: () => string;
  exportHtml: () => string;
  importSchema: (json: string) => boolean;
  save: () => boolean;
}

const DEVICE_OPTIONS = [
  { label: "PC", value: "pc" },
  { label: "Pad", value: "pad" },
  { label: "H5", value: "h5" },
];

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
}

export const SchemaDesigner = forwardRef<SchemaDesignerHandle, SchemaDesignerProps>(function SchemaDesigner(
  { pageId, repository, previewUrl, navigate, onBack, onPreview, onSaved, onExportSchema },
  ref,
) {
  const adapter = useUiAdapter();
  const storeRef = useRef<DesignerStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new DesignerStore({
      repository: repository ?? null,
      registry: createRegistry(adapter?.materials?.length ? adapter.materials : MATERIALS),
    });
  }
  const store = storeRef.current;

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [ready, setReady] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const notify = useMemo(() => resolveNotify(adapter), [adapter]);
  const ui = useMemo(() => resolveDesignerUi(adapter), [adapter]);

  useEffect(() => {
    store.setRepository(repository ?? null);
  }, [repository, store]);

  useEffect(() => {
    store.setMaterials(adapter?.materials ?? []);
  }, [adapter, store]);

  useEffect(() => {
    if (!pageId) return;
    if (!store.load(pageId)) {
      notify("页面不存在或已被删除", "error");
      onBack?.();
      return;
    }
    setReady(true);
  }, [pageId, store, notify, onBack]);

  const save = useCallback((): boolean => {
    try {
      store.save();
      notify("已保存", "success");
      onSaved?.(pageId);
      return true;
    } catch (error) {
      notify(`保存失败：${(error as Error).message}`, "error");
      return false;
    }
  }, [notify, onSaved, pageId, store]);

  const exportSchema = useCallback((): string => {
    const json = store.exportJSON();
    download(`${state.page.meta?.title ?? "page"}.json`, json, "application/json");
    void navigator.clipboard?.writeText(json);
    onExportSchema?.({ kind: "json", content: json, schema: JSON.parse(json) as PageSchema });
    notify("已导出 JSON 并复制到剪贴板", "success");
    return json;
  }, [notify, onExportSchema, state.page.meta?.title, store]);

  const exportHtml = useCallback((): string => {
    // 目录要带上：适配包追加的 defaultStyle 与业务物料的占位判定都依赖它
    const html = toHtml(state.page, { materials: store.registry });
    download(`${state.page.meta?.title ?? "page"}.html`, html, "text/html");
    onExportSchema?.({ kind: "html", content: html, schema: state.page });
    notify("已导出静态 HTML", "success");
    return html;
  }, [notify, onExportSchema, state.page, store]);

  const importSchema = useCallback(
    (json: string): boolean => {
      try {
        const { schema, applied } = migratePage(json);
        const result = validatePage(schema, store.registry.knownComponents());
        if (!result.valid) {
          throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join("；"));
        }
        store.replaceWith(schema);
        notify(applied.length ? `已导入（执行迁移 ${applied.join(", ")}）` : "已导入，记得保存", "success");
        return true;
      } catch (error) {
        notify(`导入失败：${(error as Error).message}`, "error");
        return false;
      }
    },
    [notify, store],
  );

  useImperativeHandle(ref, () => ({ exportSchema, exportHtml, importSchema, save }), [
    exportSchema,
    exportHtml,
    importSchema,
    save,
  ]);

  const backToList = useCallback(() => {
    if (state.dirty) {
      notify("当前有未保存的修改，已自动保存", "warning");
      try {
        store.save();
      } catch {
        /* 校验失败时仍然允许离开，避免卡住 */
      }
    }
    onBack?.();
  }, [notify, onBack, state.dirty, store]);

  const preview = useCallback(() => {
    if (!save()) return;
    onPreview?.(pageId);
    if (previewUrl) window.open(previewUrl(pageId), "_blank");
  }, [onPreview, pageId, previewUrl, save]);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        importSchema(String(reader.result));
        input.value = "";
      };
      reader.readAsText(file);
    },
    [importSchema],
  );

  /* 快捷键与关闭前脏检查，与 Vue 版一一对应 */
  useEffect(() => {
    if (!ready) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const withMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (withMeta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (withMeta && key === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (withMeta && key === "s") {
        event.preventDefault();
        save();
        return;
      }
      if (withMeta && key === "d") {
        event.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (withMeta && key === "c") {
        event.preventDefault();
        store.copySelected();
        return;
      }
      if (withMeta && key === "v") {
        event.preventDefault();
        store.pasteNode();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!state.selectedNode) return;
        event.preventDefault();
        store.removeSelected();
        return;
      }
      if (event.key === "Escape") store.select(null);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [ready, save, state.dirty, state.selectedNode, store]);

  const context = useMemo<DesignerContextValue>(
    () => ({ store, state, adapter, registry: store.registry, ui, notify }),
    [adapter, notify, state, store, ui],
  );

  if (!ready) return null;

  return (
    <DesignerContext.Provider value={context}>
      <div className="designer">
        <header className="topbar">
          <button className="icon-btn" title="返回页面列表" onClick={backToList}>
            ←
          </button>
          <input
            className="title-input"
            placeholder="页面标题"
            value={String(state.page.meta?.title ?? "")}
            onChange={(event) => store.setTitle(event.target.value)}
          />
          {state.dirty ? (
            <span className="dirty" title="有未保存的修改">
              ●
            </span>
          ) : null}

          <UiControl
            as="Segmented"
            size="small"
            className="device"
            options={DEVICE_OPTIONS}
            value={(state.page.meta?.device ?? "pc") as DeviceType}
            onChange={(value) => store.setDevice(String(value) as DeviceType)}
          />

          <div className="divider" />

          <button className="icon-btn" title="撤销 (Ctrl+Z)" disabled={!state.canUndo} onClick={() => store.undo()}>
            ↶
          </button>
          <button
            className="icon-btn"
            title="重做 (Ctrl+Shift+Z)"
            disabled={!state.canRedo}
            onClick={() => store.redo()}
          >
            ↷
          </button>

          <span className="stat">{state.nodeCount} 个节点</span>
          <div className="spacer" />

          <UiControl as="Button" size="small" onClick={() => fileInput.current?.click()}>
            导入
          </UiControl>
          <UiControl as="Button" size="small" onClick={exportSchema}>
            导出 JSON
          </UiControl>
          <UiControl as="Button" size="small" onClick={exportHtml}>
            导出 HTML
          </UiControl>
          <UiControl as="Button" size="small" onClick={preview}>
            预览
          </UiControl>
          <UiControl as="Button" size="small" type="primary" onClick={save}>
            保存
          </UiControl>
        </header>

        <div className="body">
          <PalettePanel />
          <OutlinePanel />
          <CanvasStage navigate={navigate} />
          <InspectorPanel />
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden-input"
          onChange={onFileChange}
        />
      </div>
    </DesignerContext.Provider>
  );
});
