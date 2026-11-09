/**
 * 设计器控件解析：适配包给了就用适配包的，没给就用原生实现。
 *
 * 这是 D3 方案在「设计器自身 UI」上的落点 —— 宿主用 Element Plus，
 * 设计器的按钮、输入框、下拉也是 Element Plus；换成别的库同理，引擎不改一行。
 */
import { inject, type Component } from "vue";
import { DESIGNER_SLOTS, type DesignerKit, type DesignerSlot, type UiAdapter } from "@x-ac/design-core";
import { UI_ADAPTER } from "../../renderer/context";
import {
  NativeButton,
  NativeColor,
  NativeInput,
  NativeNumber,
  NativeSegmented,
  NativeSelect,
  NativeSwitch,
} from "./native";

export type { DesignerKit, DesignerSlot };

export type DesignerNotifyType = "success" | "warning" | "error" | "info";

const NATIVE: Record<DesignerSlot, Component> = {
  Button: NativeButton,
  Input: NativeInput,
  NumberInput: NativeNumber,
  Select: NativeSelect,
  Switch: NativeSwitch,
  Segmented: NativeSegmented,
  ColorInput: NativeColor,
};

/**
 * 已告警的适配包实例：设计器顶栏、各面板有十几个 UiControl，每个都会解析一次控件表，
 * 用 WeakSet 按适配包实例去重，保证「一个适配包只提示一次」，不刷屏、也不随实例长期驻留。
 */
const warnedAdapters = new WeakSet<object>();

/**
 * 适配包注入了却没带 designer kit 时，给一次可见提示（不阻断、不抛错）。
 *
 * 回落原生控件是设计器既定的容错能力，缺 kit 时设计器照常可用；但「设计时与运行时
 * 同观感」这条约定被悄悄打破了，适配层作者应当知道，所以用一次 warning 显式暴露。
 *
 * 触发条件刻意收窄，避免误报：
 * - adapter 为 null（没注入适配包，纯运行时 / 裸引擎）：本就使用原生实现，不算缺失；
 * - designer 存在但只覆盖部分槽位：createDesignerKit 的合法用法（按需覆盖），不报；
 * - 仅当整个 designer 缺失才提示。
 */
function warnMissingDesignerKit(adapter: UiAdapter<unknown> | null): void {
  if (!adapter || adapter.designer || warnedAdapters.has(adapter)) return;
  warnedAdapters.add(adapter);
  // eslint-disable-next-line no-console
  console.warn(
    `[@x-ac/design-vue] 适配包「${adapter.name}」未注册 designer kit：` +
      `设计器控件已回落到内置原生实现（功能仍可用），但属性设置面板与运行时 UI 库观感不一致。` +
      `请在 defineVueAdapter({ ..., designer: createDesignerKit({ Button, Input, Select, ... }) }) 中补齐。`,
  );
}

/** 当前生效的设计器控件表（原生 → 适配包覆盖） */
export function useDesignerUi(): Record<DesignerSlot, Component> {
  const adapter = inject(UI_ADAPTER, null);
  warnMissingDesignerKit(adapter);
  const kit = (adapter?.designer ?? {}) as DesignerKit;
  const resolved = {} as Record<DesignerSlot, Component>;
  for (const slot of DESIGNER_SLOTS) {
    resolved[slot] = (kit[slot] as Component) ?? NATIVE[slot];
  }
  return resolved;
}

/** 设计器提示。适配包未提供 notify 时用内置轻提示，避免为了一个 toast 引入 UI 库 */
export function useNotify(): (message: string, type?: DesignerNotifyType) => void {
  const adapter = inject(UI_ADAPTER, null);
  const kit = (adapter?.designer ?? {}) as DesignerKit;
  if (kit.notify) return kit.notify;
  return (message: string) => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.className = "wbd-toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };
}
