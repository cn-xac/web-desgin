import type { ActionAdapter, ActionNotifyType } from "@x-ac/design-core";

export interface ReactAdapterOptions {
  notify?: (message: string, type: ActionNotifyType) => void;
  confirm?: (message: string, title?: string) => Promise<boolean>;
}

/**
 * React 侧的动作副作用适配。
 * 默认不引入任何 UI 库：提示打到 console，确认用原生 window.confirm。
 * 宿主接入 antd / MUI 时只需传自己的 notify / confirm。
 */
export function createReactAdapter(options: ReactAdapterOptions = {}): ActionAdapter {
  return {
    notify:
      options.notify ??
      ((message, type) => {
        if (type === "error" || type === "warning") console.warn(`[vue-design] ${message}`);
        else console.info(`[vue-design] ${message}`);
      }),
    confirm:
      options.confirm ??
      (async (message) => {
        if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
        return window.confirm(message);
      }),
  };
}

export const defaultAdapter: ActionAdapter = createReactAdapter();
