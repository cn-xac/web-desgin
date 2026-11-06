/**
 * 动作执行器的 Vue / Element Plus 适配。
 * 核心逻辑在 @x-ac/design-core，这里只提供宿主能力（提示框、确认框）。
 */

import { ElMessage, ElMessageBox } from "element-plus";
import {
  runActions as runCoreActions,
  type ActionAdapter,
  type ActionContext,
  type ActionNotifyType,
  type ActionSchema,
} from "@x-ac/design-core";

export interface VueActionContext extends Omit<ActionContext, "adapter"> {
  adapter?: ActionAdapter;
}

export const elementAdapter: ActionAdapter = {
  notify: (message: string, type: ActionNotifyType) => {
    ElMessage({ message, type });
  },
  confirm: async (message: string, title = "请确认") => {
    try {
      await ElMessageBox.confirm(message, title, {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      });
      return true;
    } catch {
      return false;
    }
  },
};

export function runActions(actions: ActionSchema[], ctx: VueActionContext): Promise<void> {
  return runCoreActions(actions, { ...ctx, adapter: ctx.adapter ?? elementAdapter });
}

export type { ActionAdapter, ActionNotifyType };
