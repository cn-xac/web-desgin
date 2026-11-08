/**
 * React 侧的应用级 UI 适配包注入（对齐 Vue 的 UI_ADAPTER + createVueDesign）。
 *
 * Vue 引擎用 app.provide(UI_ADAPTER, adapter) 做应用级单例；React 没有 app 实例，
 * 用 Context 表达同一语义：在应用根部挂一次，整棵子树的 SchemaRenderer 都吃到同一份
 * 适配包，不必每个渲染器重复传 ui。
 *
 * 优先级：SchemaRenderer 的 ui prop > 最近一层 Provider > nativeAdapter。
 * 老的 `<SchemaRenderer ui={adapter} />` 用法完全不变。
 */
import { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import type { UiAdapter } from "@x-ac/design-core";
import type { ReactMaterial } from "./adapter";

/**
 * 适配包上下文。null 表示宿主没有注入扩展包，渲染器回落内置原生物料。
 * 与 Vue 的 InjectionKey 一样按「应用级单例」设计：页面内不支持运行时切换，
 * 需要换库请重建 Provider 所在的根组件。
 */
export const UI_ADAPTER_CONTEXT = createContext<UiAdapter<ReactMaterial> | null>(null);

export interface ReactDesignProviderProps {
  /** 扩展仓提供的适配包，例如 antAdapter */
  adapter: UiAdapter<ReactMaterial>;
  children?: ReactNode;
}

export function ReactDesignProvider({ adapter, children }: ReactDesignProviderProps): ReactElement {
  return <UI_ADAPTER_CONTEXT.Provider value={adapter}>{children}</UI_ADAPTER_CONTEXT.Provider>;
}

/** 取当前生效的适配包；不在 Provider 内时返回 null（不是异常，方便渐进接入） */
export function useUiAdapter(): UiAdapter<ReactMaterial> | null {
  return useContext(UI_ADAPTER_CONTEXT);
}

/**
 * 对齐 createVueDesign() 的工厂形态：把 adapter 预先绑定进一个 Provider 组件。
 *
 * ```tsx
 * const DesignProvider = createReactDesign(antAdapter);
 * <DesignProvider><App /></DesignProvider>
 * ```
 */
export function createReactDesign(
  adapter: UiAdapter<ReactMaterial>,
): (props: { children?: ReactNode }) => ReactElement {
  return function BoundReactDesignProvider({ children }: { children?: ReactNode }): ReactElement {
    return <UI_ADAPTER_CONTEXT.Provider value={adapter}>{children}</UI_ADAPTER_CONTEXT.Provider>;
  };
}
