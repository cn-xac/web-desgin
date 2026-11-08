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
import type { UiEventHook } from "../actions/event";
import { materialKey } from "./keys";
import type { Material, PropFieldType } from "./types";

/** 双向绑定通道：Vue 是 { prop, event }，例如 modelValue / onUpdate:modelValue */
export interface BindingChannel {
  prop: string;
  event: string;
}

/**
 * 设计器自身 UI 的最小控件集合（D3）。
 *
 * 设计器跟着宿主选的 UI 库走，才不会「设计时一个样子、上线另一个样子」。
 * 全部可选：未提供的槽位由引擎回落原生实现，所以不写也能跑。
 */
export interface DesignerKit<TComponent = unknown> {
  Button?: TComponent;
  Input?: TComponent;
  NumberInput?: TComponent;
  Select?: TComponent;
  Switch?: TComponent;
  Segmented?: TComponent;
  ColorInput?: TComponent;
  /** 命令式提示；缺省用内置轻提示 */
  notify?: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}

export interface UiAdapter<TComponent = unknown> {
  /** 适配包标识，如 element-plus / ant-design-vue */
  name: string;
  /** 协议物料名（ec-input）→ 该 UI 库的实现 */
  components: Record<string, TComponent>;
  /** 物料元数据：物料面板、属性面板、校验面板的唯一数据源 */
  materials: Material[];
  /** 设计器属性面板的字段编辑器：PropFieldType → 控件，缺省回落原生 */
  editors?: Partial<Record<PropFieldType, TComponent>>;
  /** 设计器自身 UI 的控件（按钮 / 输入 / 下拉 / 开关 / 分段 / 取色 / 提示） */
  designer?: DesignerKit<TComponent>;
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
  /**
   * 事件归一化钩子：扩展包可在这里把自家 UI 库的事件参数改写成统一形状，
   * 或拦截某些事件。执行顺序在宿主 onEvent 之前；返回 false 阻断预设动作。
   */
  onEvent?: UiEventHook;
}

export const DEFAULT_BINDING: BindingChannel = {
  prop: "modelValue",
  event: "onUpdate:modelValue",
};

/**
 * 适配包自身缺少哪些物料实现（用于启动期自检，不抛错，只报告）。
 * 两种键名都认：适配包写 `ec-input`（协议名）、业务物料写 `biz-rate`（自有前缀）都能命中。
 */
export function missingComponents<T>(adapter: UiAdapter<T>): string[] {
  return adapter.materials
    .map((material) => material.component)
    .filter((key) => !(key in adapter.components) && !(materialKey(key) in adapter.components));
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

/* ---------------- 通用组件契约与组装工具（框架无关） ---------------- */

/**
 * 设计器控件的归一化属性契约。
 *
 * 扩展包实现 Button / Select / Segmented 时必须接受这一组语义，
 * 引擎侧只发归一化值（default / primary / danger / text），由扩展包翻译成自家 UI 库属性。
 * 放在 core 是为了让 Vue 与 React 扩展仓共用同一份契约，不各自手写一遍。
 */
export interface DesignerControlProps {
  type?: "default" | "primary" | "danger" | "text";
  size?: "small" | "default";
  disabled?: boolean;
}

/** 设计器可替换的控件槽位。DesignerKit 的键由它派生，避免两处清单漂移 */
export const DESIGNER_SLOTS = [
  "Button",
  "Input",
  "NumberInput",
  "Select",
  "Switch",
  "Segmented",
  "ColorInput",
] as const;

export type DesignerSlot = (typeof DESIGNER_SLOTS)[number];

export interface AdapterOptions<TComponent = unknown> {
  name: string;
  components: Record<string, TComponent>;
  materials: Material[];
  binding?: BindingChannel;
  actions?: ActionAdapter;
  designer?: DesignerKit<TComponent>;
  editors?: Partial<Record<PropFieldType, TComponent>>;
  provider?: TComponent;
  propAliases?: Record<string, string>;
  onEvent?: UiEventHook;
}

/**
 * 组装一份 UiAdapter：集中处理可选项与默认绑定通道。
 *
 * 纯函数，不认识框架、不读全局状态。各框架适配层的 defineXxxAdapter 只是
 * 在它外面做类型收窄，扩展仓因此不必自己拼对象字面量、也不会漏掉 binding。
 */
export function defineAdapter<TComponent = unknown>(options: AdapterOptions<TComponent>): UiAdapter<TComponent> {
  const adapter: UiAdapter<TComponent> = {
    name: options.name,
    components: options.components,
    materials: options.materials,
    binding: options.binding ?? DEFAULT_BINDING,
  };
  if (options.actions) adapter.actions = options.actions;
  if (options.designer) adapter.designer = options.designer;
  if (options.editors) adapter.editors = options.editors;
  if (options.provider !== undefined) adapter.provider = options.provider;
  if (options.propAliases) adapter.propAliases = options.propAliases;
  if (options.onEvent) adapter.onEvent = options.onEvent;
  return adapter;
}

/**
 * 裸名映射表 → 协议名映射表。
 *
 * Vue 与 React 适配层原先各写一遍 Object.fromEntries + materialKey，
 * 上移到协议层，保证「Schema 里写 ec-input、映射表写 input」这条约定只有一处实现。
 */
export function prefixedComponents<TComponent>(table: Record<string, TComponent>): Record<string, TComponent> {
  return Object.fromEntries(Object.entries(table).map(([key, value]) => [materialKey(key), value]));
}

/**
 * 生成目标 UI 库的受控属性片段。
 *
 * Schema 里始终写通用的 `modelValue`，由适配包声明的 binding 通道翻译成
 * Vue 的 `modelValue / onUpdate:modelValue` 或 React 的 `value / onChange`。
 * 纯函数，Vue 与 React 扩展仓共用，可直接 `v-bind` 或 `{...spread}`。
 */
export function bindModel<T>(
  channel: BindingChannel,
  value: T | undefined,
  onUpdate: (next: T) => void,
): Record<string, unknown> {
  return { [channel.prop]: value, [channel.event]: onUpdate };
}

/** 启动期自检结果：只报告，不抛错（缺实现时渲染器会降级占位） */
export interface AdapterReport {
  name: string;
  missing: string[];
  slots: DesignerSlot[];
  ok: boolean;
}

export function inspectAdapter<T>(adapter: UiAdapter<T>): AdapterReport {
  const missing = missingComponents(adapter);
  const kit = (adapter.designer ?? {}) as Record<string, unknown>;
  const slots = DESIGNER_SLOTS.filter((slot) => kit[slot] !== undefined);
  return { name: adapter.name, missing, slots, ok: missing.length === 0 };
}
