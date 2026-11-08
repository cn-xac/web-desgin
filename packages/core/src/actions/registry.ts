/**
 * 动作运行时（框架无关）。
 *
 * Schema 里只存 { action: '动作名', args: {} }，永远不出现可执行代码。
 * 副作用（提示、二次确认）通过 ActionAdapter 注入：
 * Vue 侧接 Element Plus，React 侧接任意 UI 库，core 不依赖任何界面框架。
 */

import type { ActionSchema, PageSchema } from "../schema/types";
import { getByPath, resolveValue, setByPath } from "../schema/expression";
import { validateData } from "../validation/engine";
import { eventScope, type UiEventPayload } from "./event";

export type ActionNotifyType = "success" | "warning" | "error" | "info";

/** 宿主环境必须提供的能力；缺省实现见 createNoopAdapter */
export interface ActionAdapter {
  notify: (message: string, type: ActionNotifyType) => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
}

export interface ActionContext {
  scope: Record<string, unknown>;
  page: PageSchema;
  errors: Record<string, string>;
  resetScope: (paths?: string[]) => void;
  navigate: (to: string) => void;
  adapter: ActionAdapter;
  /**
   * submitForm 校验通过并组装好数据行后回调（可选）。
   * 宿主（如 Vue 渲染器）用它把提交数据以事件形式抛给上层页面，
   * core 自身不关心消费方式。
   */
  onFormSubmit?: (payload: Record<string, unknown>, action: ActionSchema) => void;
  /**
   * 触发本次动作的节点事件（若由事件触发）。
   * 引擎在派发事件时注入，动作参数表达式可通过 $event / $args / $value 读取原始参数。
   */
  event?: UiEventPayload;
}

/** 动作处理器拿到的运行时上下文：多一个能识别事件参数的 resolve */
interface RuntimeContext extends ActionContext {
  resolve: (value: unknown) => unknown;
}

type Handler = (args: Record<string, unknown>, ctx: RuntimeContext) => void | Promise<void>;

/**
 * 构造运行时上下文。
 * 注意：只扩展「读取」作用域，ctx.scope 仍是页面真实状态对象，
 * setState / submitForm 的写操作不会落到临时对象上。
 */
function toRuntimeContext(ctx: ActionContext): RuntimeContext {
  const scope = eventScope(ctx.scope, ctx.event);
  return { ...ctx, resolve: (value: unknown) => resolveValue(value, scope) };
}

/** 无 UI 环境（SSR / 单测 / 静态导出）下的兜底：只把结果打到控制台 */
export function createNoopAdapter(): ActionAdapter {
  return {
    notify: (message, type) => {
      if (type === "error" || type === "warning") console.warn(`[vue-design] ${message}`);
    },
    confirm: async () => true,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 兼容入口：早期只有「必填校验」，现在语义扩展为「执行节点上的全部规则」。
 * 保留名字是为了不破坏已有调用方；新代码请直接用 validateData。
 */
export function validateRequired(
  page: PageSchema,
  scope: Record<string, unknown>,
  errors: Record<string, string>,
): boolean {
  return validateData(page, scope, { errors }).valid;
}

function resetObject(target: Record<string, unknown>): void {
  Object.keys(target).forEach((key) => {
    const value = target[key];
    if (typeof value === "string") target[key] = "";
    else if (typeof value === "boolean") target[key] = false;
    else if (typeof value === "number") target[key] = 0;
    else if (Array.isArray(value)) target[key] = [];
    else target[key] = null;
  });
}

function nowText(): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const ACTION_REGISTRY: Record<string, Handler> = {
  /** 轻提示：{ text, type } */
  toast: (args, ctx) => {
    const text = String(ctx.resolve(args.text) ?? "操作成功");
    const type = (args.type as ActionNotifyType) ?? "success";
    ctx.adapter.notify(text, type);
  },

  /** 写状态：{ path, value } */
  setState: (args, ctx) => {
    const path = String(ctx.resolve(args.path) ?? "");
    if (!path) return;
    setByPath(ctx.scope, path, ctx.resolve(args.value));
  },

  /** 还原页面状态初值 */
  resetState: (_args, ctx) => {
    ctx.resetScope();
    Object.keys(ctx.errors).forEach((key) => delete ctx.errors[key]);
    ctx.adapter.notify("已重置", "info");
  },

  /** 重置某个表单对象：{ path } */
  resetForm: (args, ctx) => {
    const path = String(ctx.resolve(args.path ?? "form") ?? "form");
    const target = getByPath(ctx.scope, path);
    if (isRecord(target)) resetObject(target);
    Object.keys(ctx.errors).forEach((key) => delete ctx.errors[key]);
  },

  /**
   * 提交表单：{ from, to, fields?, validate?, reset?, successText? }
   * from 的对象浅拷贝成一行，插入 to 数组头部。
   */
  submitForm: async (args, ctx) => {
    if (args.validate !== false && !validateRequired(ctx.page, ctx.scope, ctx.errors)) {
      const first = Object.values(ctx.errors)[0] ?? "请检查必填项";
      ctx.adapter.notify(first, "warning");
      return;
    }

    const fromKey = String(args.from ?? "form");
    const source = getByPath(ctx.scope, fromKey);
    if (!isRecord(source)) {
      ctx.adapter.notify(`找不到数据源 ${fromKey}`, "error");
      return;
    }

    const picked = Array.isArray(args.fields)
      ? (args.fields as string[]).reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = source[key];
          return acc;
        }, {})
      : { ...source };

    const row = { ...picked, submitAt: nowText() };
    const toKey = String(args.to ?? "list");
    const list = getByPath(ctx.scope, toKey);
    if (Array.isArray(list)) {
      list.unshift(row);
    } else {
      setByPath(ctx.scope, toKey, [row]);
    }

    if (args.reset !== false) resetObject(source);
    Object.keys(ctx.errors).forEach((key) => delete ctx.errors[key]);
    // 提交成功才通知宿主：校验失败、找不到数据源都不会触发
    ctx.onFormSubmit?.({ ...row }, { action: "submitForm", args });
    ctx.adapter.notify(String(ctx.resolve(args.successText) ?? "提交成功"), "success");
  },

  /** 清空数组：{ path } */
  clearList: (args, ctx) => {
    const path = String(ctx.resolve(args.path ?? "list") ?? "list");
    setByPath(ctx.scope, path, []);
    ctx.adapter.notify("已清空", "info");
  },

  /** 跳转：{ to } */
  navigate: (args, ctx) => {
    const to = String(ctx.resolve(args.to) ?? "");
    if (to) ctx.navigate(to);
  },

  /** 二次确认：{ text, then: ActionSchema[] } */
  confirm: async (args, ctx) => {
    const text = String(ctx.resolve(args.text) ?? "确认执行该操作？");
    const ok = await ctx.adapter.confirm(text, "请确认");
    if (!ok) return;
    const then = args.then;
    if (Array.isArray(then)) await runActions(then as ActionSchema[], ctx);
  },
};

/** 动作元信息：属性面板/文档共用一份，避免文案漂移 */
export interface ActionDefinition {
  name: string;
  label: string;
  hint: string;
  args: string[];
}

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  { name: "toast", label: "轻提示", hint: "弹出一次性提示", args: ["text", "type"] },
  { name: "setState", label: "写状态", hint: "把值写回页面状态", args: ["path", "value"] },
  { name: "submitForm", label: "提交表单", hint: "按节点规则校验后把对象插入列表", args: ["from", "to", "fields", "validate", "reset", "successText"] },
  { name: "resetForm", label: "重置表单", hint: "清空表单对象", args: ["path"] },
  { name: "resetState", label: "重置页面", hint: "恢复到 state 初值", args: [] },
  { name: "clearList", label: "清空列表", hint: "把数组置空", args: ["path"] },
  { name: "navigate", label: "页面跳转", hint: "路由跳转到指定地址", args: ["to"] },
  { name: "confirm", label: "二次确认", hint: "确认后再执行后续动作", args: ["text", "then"] },
];

export function runAction(action: ActionSchema, ctx: ActionContext): void {
  const handler = ACTION_REGISTRY[action.action];
  if (!handler) {
    console.warn(`[vue-design][action] 未注册的动作：${action.action}`);
    return;
  }
  try {
    const result = handler(action.args ?? {}, toRuntimeContext(ctx));
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        console.warn(`[vue-design][action] ${action.action} 执行失败`, error);
      });
    }
  } catch (error) {
    console.warn(`[vue-design][action] ${action.action} 执行失败`, error);
  }
}

export async function runActions(actions: ActionSchema[], ctx: ActionContext): Promise<void> {
  for (const action of actions) {
    const handler = ACTION_REGISTRY[action.action];
    if (!handler) continue;
    try {
      await handler(action.args ?? {}, toRuntimeContext(ctx));
    } catch (error) {
      console.warn(`[vue-design][action] ${action.action} 执行失败`, error);
    }
  }
}

/** 给属性面板用的动作清单 */
export const ACTION_OPTIONS = ACTION_DEFINITIONS.map((item) => ({
  label: item.label,
  value: item.name,
}));
