/**
 * React 设计器上下文：一次订阅，整棵面板树共享同一份快照。
 *
 * SchemaDesigner 用 useSyncExternalStore 订阅 core 的 DesignerStore，把
 * { store, state, adapter, registry, ui, notify } 放进 Context；
 * 各面板只需 useDesigner()，不必各自订阅。
 */
import { createContext, useContext } from "react";
import type { ComponentType } from "react";
import type {
  DesignerSlot,
  DesignerState,
  DesignerStore,
  MaterialRegistry,
  UiAdapter,
} from "@x-ac/design-core";
import type { ReactMaterial } from "../adapter";

export type DesignerNotifyType = "success" | "warning" | "error" | "info";

export interface DesignerContextValue {
  /** core 状态机：面板通过它写，不直接改 state */
  store: DesignerStore;
  /** 当前快照：所有读操作走这里 */
  state: DesignerState;
  /** 应用级适配包；未注入时为 null，控件与物料回落原生/通用实现 */
  adapter: UiAdapter<ReactMaterial> | null;
  /** 当前生效的物料目录（适配包 materials 优先） */
  registry: MaterialRegistry;
  /** 设计器自身控件：适配包 designer kit 优先，缺失回落原生 */
  ui: Record<DesignerSlot, ComponentType<any>>;
  notify: (message: string, type?: DesignerNotifyType) => void;
}

export const DesignerContext = createContext<DesignerContextValue | null>(null);

export function useDesigner(): DesignerContextValue {
  const value = useContext(DesignerContext);
  if (!value) throw new Error("[design-react] 设计器组件必须放在 <SchemaDesigner> 内使用");
  return value;
}
