/**
 * @x-ac/web-design-vue/kit —— Vue 扩展仓的适配层 SDK（纯净子入口）。
 *
 * 给 `vue-*` 扩展仓（design-vue-element-plus、未来的 vue-icon-* / ant-design-vue）
 * 提供组件作者需要的工厂、受控通道与设计器控件归一化契约。
 *
 * 纯度约束（改本文件时必须遵守）：
 * 1. 不得 import 任何 .vue 文件、CSS、renderer / designer 模块或 pinia；
 * 2. 不得调用 inject / useUiAdapter —— 扩展仓组件要能在 jsdom 里独立挂载；
 * 3. 这里只放 Vue 相关的纯 TS/composable，框架无关的协议与工具一律下沉到 core。
 *
 * 因此产物是一段无副作用的纯 JS，扩展仓在 SSR / 单测中不会被拖进设计器样式。
 */
import { computed, type Component, type ComputedRef } from "vue";
import {
  DEFAULT_BINDING,
  DESIGNER_SLOTS,
  bindModel,
  defineAdapter,
  inspectAdapter,
  type AdapterOptions,
  type BindingChannel,
  type DesignerKit,
  type UiAdapter,
} from "@x-ac/web-design-core";

/** Vue 引擎认的组件实现：Vue 组件或原生标签名 */
export type VueComponent = Component | string;

/** Vue 侧的缺省受控通道；扩展包若用别的拼写，在 options.binding 里覆盖 */
export const VUE_BINDING: BindingChannel = DEFAULT_BINDING;

export type VueAdapterOptions<TComponent extends VueComponent = VueComponent> = AdapterOptions<TComponent>;

/**
 * 组装一份 Vue 适配包。协议组装与默认值由 core 的 defineAdapter 统一处理，
 * 这里只收窄组件类型并给出 Vue 默认 binding，扩展仓不再手写 UiAdapter 字面量。
 */
export function defineVueAdapter<TComponent extends VueComponent>(
  options: VueAdapterOptions<TComponent>,
): UiAdapter<TComponent> {
  return defineAdapter<TComponent>({ ...options, binding: options.binding ?? VUE_BINDING });
}

/**
 * 受控字段的统一通道：读通用 modelValue，回写并转发 change。
 *
 * SFC 里的 defineProps / defineEmits 是编译期宏，无法由工厂代劳；
 * 这个 composable 消掉的是每个字段组件重复的 onChange 样板，并把
 * 「读值 / 回写 / change 转发」三件事收敛到一处。
 */
export function useFieldModel<T>(
  read: () => T | undefined,
  update: (value: T) => void,
  change?: (value: T) => void,
): { model: ComputedRef<T | undefined>; onUpdate: (value: T) => void } {
  const model = computed(() => read());
  const onUpdate = (value: T): void => {
    update(value);
    change?.(value);
  };
  return { model, onUpdate };
}

/**
 * 归一化设计器控件表：按 core 的槽位清单过滤未实现项，
 * 保证引擎的「适配包给就用适配包的，没给回落原生」判断不会被显式 undefined 干扰。
 */
export function createDesignerKit<TComponent extends VueComponent>(kit: DesignerKit<TComponent>): DesignerKit<TComponent> {
  const result: DesignerKit<TComponent> = {};
  const target = result as unknown as Record<string, unknown>;
  for (const slot of DESIGNER_SLOTS) {
    const value = kit[slot];
    if (value !== undefined) target[slot] = value;
  }
  if (kit.notify) result.notify = kit.notify;
  return result;
}

// 框架无关的通用工具与契约从 core 透出，扩展仓不必再单独装协议层
export { bindModel, inspectAdapter };
export type {
  AdapterReport,
  BindingChannel,
  DesignerControlProps,
  DesignerKit,
  DesignerSlot,
  UiAdapter,
} from "@x-ac/web-design-core";
