import { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CSSProperties, ElementType } from "react";
import type {
  ActionAdapter,
  DataExportOptions,
  DataExportResult,
  Material,
  MaterialRegistry,
  NodeSchema,
  PageSchema,
  UiAdapter,
  UiEventHook,
  UiEventPayload,
} from "@x-ac/web-design-core";
import {
  createEmptyPage,
  createRegistry,
  deepClone,
  exportData,
  migratePage,
  validateData,
  validateNodeField,
} from "@x-ac/web-design-core";
import { SchemaNode } from "./SchemaNode";
import { RenderContext, BINDING_BASE } from "./context";
import type { RenderContextValue, RenderMode, RendererDesignerScene } from "./context";
import { defaultAdapter } from "./actions";
import { nativeAdapter, type ReactMaterial } from "./adapter";
import { useUiAdapter } from "./provider";
import { usePageStore } from "./scope";

export interface SchemaRendererProps {
  /** 页面 Schema 对象，或后端返回的 JSON 字符串（自动解析并迁移旧版本） */
  page: PageSchema | string;
  /** view：挂事件、跑动作；edit：只渲染 */
  mode?: RenderMode;
  /** 动作里的「页面跳转」交给宿主，组件自身不承担路由 */
  navigate?: (to: string) => void;
  /**
   * UI 适配包：组件实现 + 物料元数据 + 双向绑定通道。
   * 优先级：本 prop > <ReactDesignProvider adapter> > 内置 nativeAdapter。
   */
  ui?: UiAdapter<ReactMaterial>;
  /** 只覆盖动作副作用（提示 / 确认框）；缺省取 ui.actions，再缺省 console + window.confirm */
  adapter?: ActionAdapter;
  /** 外部数据，优先于 page.state 作为初始 scope（对齐 Vue 的 v-model:data） */
  data?: Record<string, unknown>;
  /** scope 变化回传；宿主原样绑回 data 时不会形成回环 */
  onDataChange?: (data: Record<string, unknown>) => void;
  /** submitForm 动作校验通过、数据组装完成时回调（对齐 Vue 的 @submit） */
  onSubmit?: (payload: Record<string, unknown>) => void;
  /**
   * 事件拦截钩子：每个节点事件都会先收到完整 UiEventPayload。
   * 返回 false 或 payload.preventDefault() 可跳过该事件配置的预设动作。
   */
  onEvent?: UiEventHook;
  /**
   * 节点事件只读通知（对齐 Vue 的 @node-event）。
   * 与 onEvent 的区别：不参与控制流，返回值被忽略；
   * 即使 onEvent / adapter.onEvent 调用了 preventDefault()，这里仍会收到该事件，
   * 方便做埋点、日志、外部状态镜像，而不必担心影响预设动作。
   */
  onNodeEvent?: (payload: UiEventPayload) => void;
  /**
   * 设计态：画布节点带选中 / 悬停 / 拖拽能力（对齐 Vue 的 design prop）。
   * 仅在 SchemaDesigner 内部使用，普通运行时不传。
   */
  design?: boolean;
  /** 设计器注入的画布场景；与 design 成对出现 */
  designer?: RendererDesignerScene;
  className?: string;
  style?: CSSProperties;
}

/** 通过 ref 调用的命令式 API（与 Vue 版 defineExpose 对齐） */
export interface SchemaRendererHandle {
  /** 校验整页数据，错误会显示到对应字段下方 */
  validate: () => boolean;
  /** 收集表单数据（默认顺带校验） */
  getData: (options?: DataExportOptions) => DataExportResult;
  /** getData 的语义化别名 */
  exportData: (options?: DataExportOptions) => DataExportResult;
  getErrors: () => Record<string, string>;
  /** 恢复到 state 初值并清空错误 */
  reset: () => void;
  /** 宿主主动灌数据（区别于 data prop 的另一种显式通道） */
  setData: (patch: Record<string, unknown>) => void;
  /** 重新执行 dataSource 取数 */
  reload: () => void;
  scope: Record<string, unknown>;
}

/**
 * 物料目录缓存：以 materials 数组引用为键。
 * 同一个 adapter 反复渲染不会重复建表；换适配包自然命中新键。
 */
const registryCache = new WeakMap<Material[], MaterialRegistry>();

function registryFor(materials: Material[]): MaterialRegistry {
  let registry = registryCache.get(materials);
  if (!registry) {
    registry = createRegistry(materials);
    registryCache.set(materials, registry);
  }
  return registry;
}

/** 设备宽度与 Vue 渲染器保持一致：h5 / pad / pc */
function deviceMaxWidth(page: PageSchema): number {
  const device = page.meta?.device ?? "pc";
  if (device === "h5") return 420;
  if (device === "pad") return 768;
  return 960;
}

export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(function SchemaRenderer(
  { page, mode = "view", navigate, ui, adapter, data, onDataChange, onSubmit, onEvent, onNodeEvent, design = false, designer, className, style },
  ref,
) {
  // Hook 必须无条件调用：prop 显式传入时仍读一次 Context，但不会用它
  const inheritedUi = useUiAdapter();
  const activeUi = ui ?? inheritedUi ?? nativeAdapter;

  const { schema, parseError } = useMemo(() => {
    if (typeof page !== "string") return { schema: page, parseError: "" };
    try {
      return { schema: migratePage(page).schema, parseError: "" };
    } catch (error) {
      return { schema: createEmptyPage(), parseError: `页面 JSON 解析失败：${(error as Error).message}` };
    }
  }, [page]);

  const store = usePageStore(schema, data);
  const catalog = registryFor(activeUi.materials);
  const actions = adapter ?? activeUi.actions ?? defaultAdapter;

  /* ---------- data 双向：scope → 宿主 ---------- */
  const lastEmitted = useRef("");
  const applyingExternal = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    // 首次挂载不回传初值，与 Vue 的非 immediate watch 一致
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (applyingExternal.current) return;
    let snapshot: Record<string, unknown>;
    try {
      snapshot = deepClone(store.scope);
    } catch {
      return;
    }
    const json = JSON.stringify(snapshot);
    if (json === lastEmitted.current) return;
    lastEmitted.current = json;
    onDataChange?.(snapshot);
  }, [store.version, onDataChange]);

  /* ---------- data 双向：宿主 → scope ---------- */
  useEffect(() => {
    if (!data) return;
    let json: string;
    try {
      json = JSON.stringify(data);
    } catch {
      return;
    }
    // 宿主把刚 emit 的值原样绑定回来：忽略，避免回环
    if (json === lastEmitted.current) return;
    applyingExternal.current = true;
    store.replaceScope(data);
    void Promise.resolve().then(() => {
      applyingExternal.current = false;
    });
  }, [data]);

  /** 失焦校验：只算当前字段，改完立即消红 */
  const validateField = (node: NodeSchema): void => {
    const issue = validateNodeField(node, store.scope, undefined, catalog);
    store.patchError(node.id, issue ? issue.message : null);
  };

  useImperativeHandle(ref, () => ({
    validate() {
      const errors: Record<string, string> = { ...store.errors };
      const result = validateData(schema, store.scope, { errors, materials: catalog });
      store.setErrors(errors);
      return result.valid;
    },
    getData(options?: DataExportOptions) {
      // 目录必须带上：否则业务物料（isFormControl）会被当成非表单组件，字段直接丢
      return exportData(schema, store.scope, { ...options, materials: catalog });
    },
    exportData(options?: DataExportOptions) {
      return exportData(schema, store.scope, { ...options, materials: catalog });
    },
    getErrors() {
      return { ...store.errors };
    },
    reset() {
      store.resetScope();
    },
    setData(patch: Record<string, unknown>) {
      Object.assign(store.scope, deepClone(patch));
      store.flush();
    },
    reload() {
      store.reload();
    },
    get scope() {
      return store.scope;
    },
  }));

  const ctx: RenderContextValue = {
    page: schema,
    scope: store.scope,
    errors: store.errors,
    mode,
    adapter: actions,
    ui: activeUi,
    catalog,
    navigate: navigate ?? (() => undefined),
    resetScope: store.resetScope,
    flush: store.flush,
    setValue: store.setValue,
    validateField,
    onEvent,
    notifyEvent: (payload) => onNodeEvent?.(payload),
    design,
    designer,
    onFormSubmit: onSubmit ? (payload) => onSubmit(payload) : undefined,
  };

  const rootClass = className ? `ux-page ${className}` : "ux-page";
  const alert = parseError || store.dataError;
  const content = (
    <div
      className={store.loading ? `${rootClass} is-loading` : rootClass}
      style={{ maxWidth: deviceMaxWidth(schema), ...style }}
    >
      {alert ? <div className="ux-renderer__alert">{alert}</div> : null}
      {(schema.children ?? []).map((node) => (
        <SchemaNode key={node.id} node={node} />
      ))}
    </div>
  );

  // 适配包的外层 Provider（主题 / 语言 / 消息上下文）。未配置时直接渲染 content，
  // 不产生额外 DOM，根节点结构与样式选择器保持不变。
  const provider = activeUi.provider as ElementType | undefined;

  return (
    <RenderContext.Provider value={ctx}>
      <BINDING_BASE.Provider value="form">
        {provider ? createElement(provider, null, content) : content}
      </BINDING_BASE.Provider>
    </RenderContext.Provider>
  );
});
