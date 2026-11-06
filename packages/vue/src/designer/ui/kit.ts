/**
 * 设计器控件解析：适配包给了就用适配包的，没给就用原生实现。
 *
 * 这是 D3 方案在「设计器自身 UI」上的落点 —— 宿主用 Element Plus，
 * 设计器的按钮、输入框、下拉也是 Element Plus；换成别的库同理，引擎不改一行。
 */
import { inject, type Component } from "vue";
import type { DesignerKit } from "@x-ac/design-core";
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

export type { DesignerKit };

export type DesignerSlot = "Button" | "Input" | "NumberInput" | "Select" | "Switch" | "Segmented" | "ColorInput";

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

/** 当前生效的设计器控件表（原生 → 适配包覆盖） */
export function useDesignerUi(): Record<DesignerSlot, Component> {
  const adapter = inject(UI_ADAPTER, null);
  const kit = (adapter?.designer ?? {}) as DesignerKit;
  const resolved = {} as Record<DesignerSlot, Component>;
  for (const slot of Object.keys(NATIVE) as DesignerSlot[]) {
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
