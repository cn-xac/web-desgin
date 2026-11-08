/**
 * 节点事件协议（框架无关）。
 *
 * 渲染器把「组件派发事件」统一成一份 UiEventPayload 再交给开发者与动作系统：
 * - Vue：@row-click="(row, column, event) => ..." → args = [row, column, event]
 * - React：onRowClick(row, column, event)        → args = [row, column, event]
 *
 * 两侧拿到的 payload 形状完全一致，业务代码与扩展仓不必分别适配。
 * 本文件不访问 DOM 全局、不 import 任何框架，符合 core 的纯函数约束。
 */
import type { Scope } from "../schema/expression";
import type { ActionSchema, NodeSchema, PageSchema } from "../schema/types";
import type { Material } from "../materials/types";

/** 事件钩子：返回 false 或调用 payload.preventDefault() 可阻断该事件配置的预设动作 */
export type UiEventHook = (payload: UiEventPayload) => void | false;

export interface UiEventPayload {
  /** Schema 里写的事件名，如 click / change / row-click */
  readonly name: string;
  /** 框架侧实际绑定的处理器名，Vue 是 rowClick、React 是 onRowClick */
  readonly handlerName: string;
  readonly node: NodeSchema;
  readonly nodeId: string;
  readonly component: string;
  readonly material?: Material;
  readonly page: PageSchema;
  /** 页面作用域，开发者可在钩子里直接读写（与渲染器同一对象） */
  readonly scope: Scope;
  /** 组件派发的原始参数列表；可直接改写以做归一化 */
  readonly args: unknown[];
  /** args[0] 的快捷访问（随 args 变化） */
  readonly value: unknown;
  /** 参数中识别出的原生 DOM 事件（鸭子类型判断，不依赖 DOM 全局） */
  readonly nativeEvent: unknown;
  /** 该事件在 Schema 里配置的动作清单 */
  readonly actions: ActionSchema[];
  readonly defaultPrevented: boolean;
  /** 阻断后续钩子与预设动作 */
  preventDefault(): void;
  /** 透传到原生事件的 stopPropagation */
  stopPropagation(): void;
}

export interface UiEventInit {
  name: string;
  handlerName: string;
  node: NodeSchema;
  material?: Material;
  page: PageSchema;
  scope: Scope;
  args: unknown[];
  actions: ActionSchema[];
}

interface EventLike {
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

/** 鸭子类型识别原生事件：SSR / jsdom / 自定义事件对象都能命中 */
function isEventLike(value: unknown): value is EventLike {
  if (typeof value !== "object" || value === null) return false;
  return "preventDefault" in value || "currentTarget" in value || "target" in value;
}

export function pickNativeEvent(args: unknown[]): unknown {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (isEventLike(args[index])) return args[index];
  }
  return undefined;
}

export function createEventPayload(init: UiEventInit): UiEventPayload {
  let prevented = false;
  const args = [...init.args];

  return {
    name: init.name,
    handlerName: init.handlerName,
    node: init.node,
    nodeId: init.node.id,
    component: init.node.component,
    material: init.material,
    page: init.page,
    scope: init.scope,
    args,
    actions: init.actions,
    get value() {
      return args[0];
    },
    get nativeEvent() {
      return pickNativeEvent(args);
    },
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      const event = pickNativeEvent(args);
      if (isEventLike(event)) event.stopPropagation?.();
    },
  };
}

/** kebab-case → camelCase（Vue 的 v-on 对象绑定要求驼峰，Vue 内部自行补 on 前缀） */
export function camelizeEventName(name: string): string {
  return name.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

/** kebab-case → React 的 onXxx 处理器名：row-click → onRowClick */
export function toReactHandlerName(name: string): string {
  const camel = camelizeEventName(name);
  return `on${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/**
 * 动作参数表达式的求值作用域。
 * 不直接改动页面 scope（写操作必须落在真实状态对象上），只在读取时叠加：
 *   $event / $args / $value
 */
export function eventScope(scope: Scope, payload?: UiEventPayload): Scope {
  if (!payload) return scope;
  return { ...scope, $event: payload, $args: payload.args, $value: payload.value };
}

/**
 * 按序执行事件钩子，返回是否继续执行预设动作。
 * 顺序：扩展包归一化 → 宿主钩子；任一钩子抛错只告警，不让页面崩。
 */
export function runEventHooks(payload: UiEventPayload, hooks: Array<UiEventHook | undefined>): boolean {
  for (const hook of hooks) {
    if (!hook) continue;
    try {
      if (hook(payload) === false) payload.preventDefault();
    } catch (error) {
      console.warn(`[vue-design][event] ${payload.name} 钩子执行失败`, error);
    }
    if (payload.defaultPrevented) return false;
  }
  return true;
}
