/**
 * @x-ac/design-react/kit —— React 扩展仓的适配层 SDK（纯净子入口）。
 *
 * 与 @x-ac/design-vue/kit 对称：给 `react-*` 扩展仓（未来的 react-ant 等）
 * 提供组装工厂、受控通道与设计器控件契约。框架无关的协议与工具统一在 core。
 *
 * 纯度约束：不 import ./index（它带 styles.css 副作用）、不 import react-dom，
 * 不读取任何 Context —— 扩展仓组件要能脱离引擎独立单测与 SSR。
 * 本文件也不 import ./adapter，避免与内置适配包形成循环依赖。
 */
import { useCallback, useMemo, type ComponentType } from "react";
import {
  bindModel,
  defineAdapter,
  inspectAdapter,
  type AdapterOptions,
  type BindingChannel,
  type DesignerKit,
  type UiAdapter,
} from "@x-ac/design-core";

/** React 引擎认的组件实现；比内置 ReactMaterial 宽松，允许扩展仓自带 props 形状 */
export type ReactComponent = ComponentType<any> | string;

/**
 * React 的受控组件通道：`value` + `onChange`。
 * 与 Vue 的 `modelValue` + `onUpdate:modelValue` 是同一件事的不同拼写。
 * 定义在 kit 里，内置 nativeAdapter 与扩展仓共用同一份常量。
 */
export const REACT_BINDING = { prop: "value", event: "onChange" } as const;

export type ReactAdapterOptions<TComponent extends ReactComponent = ReactComponent> = AdapterOptions<TComponent>;

/** 组装一份 React 适配包，默认走 value / onChange */
export function defineReactAdapter<TComponent extends ReactComponent>(
  options: ReactAdapterOptions<TComponent>,
): UiAdapter<TComponent> {
  return defineAdapter<TComponent>({ ...options, binding: options.binding ?? REACT_BINDING });
}

/**
 * 受控字段的统一通道，返回可直接展开的属性片段：
 * `const bound = useFieldModel(value, setValue); return <Input {...bound} />;`
 *
 * channel 由扩展包声明，换 UI 库时组件实现不用改。
 */
export function useFieldModel<T>(
  value: T | undefined,
  update: (value: T) => void,
  channel: BindingChannel = REACT_BINDING,
): Record<string, unknown> {
  const onUpdate = useCallback((next: T) => update(next), [update]);
  return useMemo(() => bindModel(channel, value, onUpdate), [channel, value, onUpdate]);
}

/** 归一化设计器控件表（与 Vue 侧同一份 core 契约） */
export function createDesignerKit<TComponent extends ReactComponent>(
  kit: DesignerKit<TComponent>,
): DesignerKit<TComponent> {
  return { ...kit };
}

export { bindModel, inspectAdapter };
export type {
  AdapterReport,
  BindingChannel,
  DesignerControlProps,
  DesignerKit,
  DesignerSlot,
  UiAdapter,
} from "@x-ac/design-core";
