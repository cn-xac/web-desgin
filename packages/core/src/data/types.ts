import type { Method, RequestInstance } from "../request/types";
import type { Scope } from "../schema/expression";

/**
 * 数据调控中心的核心契约类型。
 *
 * 设计定位：core 内置、框架无关的「取数描述 + 归一化 + 缓存」层，
 * 位于已建的 request 传输层之上。它服务两类后续场景：
 * - 外部数据源（rg4KCt）：把 HTTP 响应映射为选项 label/value 或写回元素属性；
 * - 绑定数据（ruUqAF）：参数里的 {{path}} 绑定到页面/表单 scope。
 *
 * 设计器、渲染器、provider 共用同一份 DataBinding 契约，做到 Schema 驱动。
 *
 * 注：归一化后的选项形态复用 materials/utils 的 OptionItem（{ label, value: string }），
 * 与渲染器既有契约一致，避免重复定义。级联（children）/ 禁用态留二期。
 */

/**
 * 绑定上下文：{{}} 求值的解析目标。
 * - scope 为主（页面 / 表单数据）；
 * - elementValues 可选（页面元素值表，合并进 scope 解析，键冲突以 elementValues 优先）。
 */
export interface BindingContext {
  scope: Scope;
  elementValues?: Scope;
}

export type DataShape = "select" | "radio" | "checkbox" | "form";
/** v1 仅被动触发（页面加载 / 显式调用）；输入触发（触发长度）与子表单映射留二期 */
export type TriggerType = "load" | "manual";

export interface CacheConfig {
  /** 毫秒；缺省视为页面级（不过期，对应 rg4KCt「只请求一次」） */
  ttl?: number;
}

/**
 * 数据源绑定契约（Schema 描述）。
 * 注：type 当前仅 'http'，预留扩展（如 'static' / 'function'）。
 */
export interface DataBinding {
  type: "http";
  url: string;
  method?: Method;
  /** 请求参数；值支持 {{path}} 绑定到 BindingContext */
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** 归一化形态；缺省 form（原样返回） */
  shape?: DataShape;
  /** 选项形态下从数组项取 label / value 的字段名（缺省 label / value） */
  labelField?: string;
  valueField?: string;
  /** 当响应是 { list: [...] } 这类包裹结构时，取出数组的字段名 */
  listField?: string;
  /** 任意结构兜底转换；收到「原始响应」或「选项数组」取决于 shape，详见 normalize */
  transform?: (raw: unknown, ctx: BindingContext) => unknown;
  cache?: CacheConfig;
  trigger?: TriggerType;
}

export interface ProviderConfig {
  /** 绑定的请求客户端（默认就是 getDefaultRequest() 返回的实例） */
  request: RequestInstance;
  cache?: CacheConfig;
}

/** 数据提供方：按契约取数并归一化 */
export interface DataProvider {
  load(binding: DataBinding, ctx: BindingContext): Promise<unknown>;
}
