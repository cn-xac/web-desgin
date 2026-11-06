/**
 * 动作执行入口。
 *
 * core 只定义动作语义（submitForm / navigate / validate / resetFields ...），
 * 提示框与确认框这类副作用由适配包提供 —— 引擎不假定宿主装了哪个 UI 库。
 * 未注入适配包时用 noop 兜底：动作照常执行，只是没有弹窗。
 */
import {
  createNoopAdapter,
  runActions as runCoreActions,
  type ActionAdapter,
  type ActionContext,
  type ActionSchema,
} from "@x-ac/design-core";

export type NodeActionContext = Omit<ActionContext, "adapter">;

let warned = false;

export function runNodeActions(
  actions: ActionSchema[],
  ctx: NodeActionContext,
  adapter?: ActionAdapter,
): Promise<void> {
  if (!adapter && !warned) {
    warned = true;
    console.warn("[vue-design] 未注入 UI 适配包：提示框与确认框降级为 no-op，页面其余功能正常");
  }
  return runCoreActions(actions, { ...ctx, adapter: adapter ?? createNoopAdapter() });
}
