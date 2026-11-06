/**
 * 适配包契约（ADR-14）。
 *
 * 一个 UI 库 = 一个 UiAdapter。设计器与运行时共用同一份 adapter，
 * 所以「设计时看到的」与「上线渲染的」是同一套组件、同一套主题、同一套语言 —— 不出戏。
 *
 * 本文件属于协议层：只描述形状，不认识 vue / react / 任何 UI 库。
 * 组件引用一律用泛型占位，由 Vue / React 引擎各自收窄类型。
 */
import type { ActionAdapter } from "../actions/registry";
import type { Material, PropFieldType } from "./types";

/** 双向绑定通道：Vue 是 { prop, event }，例如 modelValue / onUpdate:modelValue */
export interface BindingChannel {
  prop: string;
  event: string;
}

/** 设计器外壳需要的最小控件集合，缺省由引擎回落原生实现 */
export type DesignerChromeSlot =
  | "Button"
  | "Input"
  | "Select"
  | "Switch"
  | "Tabs"
  | "Tooltip"
  | "Message"
  | "Drawer";

export interface UiAdapter<TComponent = unknown> {
  /** 适配包标识，如 element-plus / ant-design-vue */
  name: string;
  /** 协议物料名（ec-input）→ 该 UI 库的实现 */
  components: Record<string, TComponent>;
  /** 物料元数据：物料面板、属性面板、校验面板的唯一数据源 */
  materials: Material[];
  /** 设计器属性面板的字段编辑器：PropFieldType → 控件，缺省回落原生 */
  editors?: Partial<Record<PropFieldType, TComponent>>;
  /** 设计器外壳控件，缺省回落原生；官方适配包应提供以保持一致观感 */
  chrome?: Partial<Record<DesignerChromeSlot, TComponent>>;
  /** 主题 / 语言 / 消息上下文的外层包装（NConfigProvider、a-config-provider 等） */
  provider?: TComponent;
  /** 该库的双向绑定通道，缺省 modelValue / onUpdate:modelValue */
  binding?: BindingChannel;
  /**
   * 属性别名：Schema 里的通用通道名 → 该库的真实属性名。
   * 只做「同名不同拼写」的映射（maxlength ↔ maxLength），不做语义转换。
   */
  propAliases?: Record<string, string>;
  /** 消息 / 确认框等副作用 */
  actions?: ActionAdapter;
}

export const DEFAULT_BINDING: BindingChannel = {
  prop: "modelValue",
  event: "onUpdate:modelValue",
};

/** 适配包自身缺少哪些物料实现（用于启动期自检，不抛错，只报告） */
export function missingComponents<T>(adapter: UiAdapter<T>): string[] {
  return adapter.materials
    .map((material) => material.component)
    .filter((key) => !(key in adapter.components));
}

/**
 * 不可变组合：宿主在自己项目里追加业务物料，不修改原适配包。
 * 全局可变注册表在 SSR 多请求与测试并行时会互相污染，所以只提供组合，不提供 register()。
 */
export function withMaterials<T>(adapter: UiAdapter<T>, materials: Material[]): UiAdapter<T> {
  if (!materials.length) return adapter;
  const merged = new Map(adapter.materials.map((item) => [item.component, item]));
  for (const material of materials) merged.set(material.component, material);
  return { ...adapter, materials: [...merged.values()] };
}
