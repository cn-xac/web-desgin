import { forwardRef, useImperativeHandle } from "react";
import type { CSSProperties } from "react";
import type {
  ActionAdapter,
  DataExportOptions,
  DataExportResult,
  Material,
  MaterialRegistry,
  NodeSchema,
  PageSchema,
  UiAdapter,
} from "@x-ac/design-core";
import { createRegistry, exportData, validateData, validateNodeField } from "@x-ac/design-core";
import { SchemaNode } from "./SchemaNode";
import { RenderContext } from "./context";
import type { RenderContextValue, RenderMode } from "./context";
import { defaultAdapter } from "./actions";
import { nativeAdapter, type ReactMaterial } from "./adapter";
import { useUiAdapter } from "./provider";
import { usePageStore } from "./scope";

export interface SchemaRendererProps {
  page: PageSchema;
  /** view：挂事件、跑动作；edit：只渲染 */
  mode?: RenderMode;
  /** 动作里的「页面跳转」交给宿主，组件自身不承担路由 */
  navigate?: (to: string) => void;
  /**
   * UI 适配包：组件实现 + 物料元数据 + 双向绑定通道。
   * 优先级：本 prop > <ReactDesignProvider adapter> > 内置 nativeAdapter。
   * 传 `registerMaterials(nativeAdapter, [...])` 的结果即可让业务物料参与渲染与校验。
   */
  ui?: UiAdapter<ReactMaterial>;
  /** 只覆盖动作副作用（提示 / 确认框）；缺省取 ui.actions，再缺省 console + window.confirm */
  adapter?: ActionAdapter;
  className?: string;
  style?: CSSProperties;
}

/** 通过 ref 调用的命令式 API（与 Vue 版 defineExpose 对齐） */
export interface SchemaRendererHandle {
  /** 校验整页数据，错误会显示到对应字段下方 */
  validate: () => boolean;
  /** 收集表单数据（默认顺带校验） */
  getData: (options?: DataExportOptions) => DataExportResult;
  getErrors: () => Record<string, string>;
  /** 恢复到 state 初值并清空错误 */
  reset: () => void;
  scope: Record<string, unknown>;
}

/**
 * 物料目录缓存：以 materials 数组引用为键。
 * 同一个 adapter 反复渲染不会重复建表；换适配包自然命中新键。
 * （与 Vue 版 useMaterialCatalog 的 WeakMap 缓存同源，避免两边行为分叉）
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

/**
 * 用一份 PageSchema 渲染页面。
 *
 * ```tsx
 * const ref = useRef<SchemaRendererHandle>(null);
 * <SchemaRenderer ref={ref} page={page} navigate={(to) => router.push(to)} />
 * ref.current?.validate();
 * ref.current?.getData();
 * ```
 */
export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(function SchemaRenderer(
  { page, mode = "view", navigate, ui, adapter, className, style },
  ref,
) {
  // Hook 必须无条件调用：prop 显式传入时仍读一次 Context，但不会用它
  const inheritedUi = useUiAdapter();
  const activeUi = ui ?? inheritedUi ?? nativeAdapter;

  const store = usePageStore(page);
  const catalog = registryFor(activeUi.materials);
  const actions = adapter ?? activeUi.actions ?? defaultAdapter;

  /** 失焦校验：只算当前字段，改完立即消红 */
  const validateField = (node: NodeSchema): void => {
    const issue = validateNodeField(node, store.scope, undefined, catalog);
    store.patchError(node.id, issue ? issue.message : null);
  };

  useImperativeHandle(ref, () => ({
    validate() {
      const errors: Record<string, string> = { ...store.errors };
      const result = validateData(page, store.scope, { errors, materials: catalog });
      store.setErrors(errors);
      return result.valid;
    },
    getData(options?: DataExportOptions) {
      // 目录必须带上：否则业务物料（isFormControl）会被当成非表单组件，字段直接丢
      return exportData(page, store.scope, { ...options, materials: catalog });
    },
    getErrors() {
      return { ...store.errors };
    },
    reset() {
      store.resetScope();
    },
    get scope() {
      return store.scope;
    },
  }));

  const ctx: RenderContextValue = {
    page,
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
  };

  return (
    <RenderContext.Provider value={ctx}>
      <div className={className ? `ux-page ${className}` : "ux-page"} style={style}>
        {page.children.map((node) => (
          <SchemaNode key={node.id} node={node} />
        ))}
      </div>
    </RenderContext.Provider>
  );
});
