/**
 * 外部数据源（对应待办 rg4KCt）。
 *
 * 定位：把一个 HTTP 接口配置成页面可消费的数据，能力覆盖
 * 「输入框 / 下拉选择等场景中作为数据来源使用」。
 *
 * 三条设计约束（决定了下面的实现形状）：
 *
 * 1. **配置挂在节点上**（node.dataSource）。谁用它，决定了参数映射选哪些元素、
 *    响应映射写到哪里；放在页面级则每个元素都得重复写一遍「我引用哪个源」。
 *
 * 2. **结果统一写进 scope 的一个路径**，元素再通过 {{}} 读它。
 *    这样「响应映射到某个元素」= 把 scopePath 指向该元素的绑定路径，
 *    与既有的表达式机制完全同构，渲染器不需要为外部数据源开任何特例。
 *
 * 3. **取数走 core 的 request 层 + provider 缓存**，
 *    「只请求一次」就是页面级 TTL 缓存（不过期），「每次都取」就是 ttl = 0 不入缓存。
 */

import type { Method } from "../request/types";
import { getByPath, resolveValue, setByPath } from "../schema/expression";
import type { Scope } from "../schema/expression";
import type { NodeSchema, PageSchema } from "../schema/types";
import type { BindingContext, DataBinding, DataShape } from "./types";
import { getProvider } from "./registry";

/* ----------------------------- 配置契约 ----------------------------- */

/**
 * 请求参数映射项。
 * - key：接口参数名；
 * - path：取值路径，指向当前页面某个元素的值（形如 form.keyword）。
 *
 * 「仅限当前页面选择元素」由设计器保证：它只会吐出页面上真实存在的元素路径。
 * 「支持将整个子表单作为单个参数值」= path 指向明细数组本身（如 form.items）。
 */
export interface ExternalParamMap {
  key: string;
  path: string;
  /** 展示名，写进 Schema 便于阅读；不影响运行时 */
  label?: string;
}

/** 响应数据映射 */
export interface ExternalResponseMap {
  /** 结果写入 scope 的路径。映射到某个元素时 = 该元素的绑定路径 */
  scopePath: string;
  /** 从响应里取出数组的字段名（如 data.list） */
  listField?: string;
  /** 选项形态：label 取值字段 */
  labelField?: string;
  /** 选项形态：value 取值字段 */
  valueField?: string;
  /** 归一化形态；缺省 form（原样返回） */
  shape?: DataShape;
}

export interface ExternalDataSource {
  /** 数据源名称，仅用于展示 */
  name?: string;
  /** 请求方法；缺省 GET */
  method?: Method;
  /** 请求地址 */
  url: string;
  /** 请求头（独立弹窗设置） */
  headers?: Record<string, string>;
  /** 请求参数映射：值来自页面上选中的元素 */
  params?: ExternalParamMap[];
  /** 响应数据映射 */
  response?: ExternalResponseMap;
  /** 只请求一次（当前页面仅请求一次）；缺省 true */
  once?: boolean;
  /** 触发长度：输入达到该长度才发请求；0 / 缺省 = 页面加载即取 */
  triggerLength?: number;
  /** 触发时读取的输入路径；缺省用响应目标元素自身的绑定路径 */
  triggerPath?: string;
}

/* ----------------------------- 工具 ----------------------------- */

/** 外部数据源的默认响应路径：external.<name> */
export function defaultScopePath(name?: string): string {
  // 保留中英文与数字，只去掉会让路径难读的符号
  const key = (name ?? "").trim().replace(/[^\w$一-龥]/g, "") || "data";
  return `external.${key}`;
}

/** 是否「只请求一次」；缺省为 true（页面级取数最常见的诉求） */
export function isOnceOnly(source: ExternalDataSource): boolean {
  return source.once !== false;
}

/**
 * 触发判定：输入长度达到阈值才算触发。
 * 缺省阈值（0 / 未设）表示「页面加载即取」，不由输入触发。
 */
export function reachesTriggerLength(source: ExternalDataSource, value: unknown): boolean {
  const threshold = Number(source.triggerLength ?? 0);
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  const text = value === null || value === undefined ? "" : String(value);
  return text.length >= threshold;
}

/** 把外部数据源翻译成 core 的 DataBinding（参数值统一走 {{}} 绑定） */
export function toDataBinding(source: ExternalDataSource): DataBinding {
  const params: Record<string, unknown> = {};
  for (const item of source.params ?? []) {
    if (!item?.key) continue;
    params[item.key] = item.path ? `{{${item.path}}}` : "";
  }

  const response = source.response;
  return {
    type: "http",
    url: source.url,
    method: source.method ?? "GET",
    headers: source.headers,
    params,
    shape: response?.shape ?? "form",
    listField: response?.listField,
    labelField: response?.labelField,
    valueField: response?.valueField,
    // 「只请求一次」= 不过期；否则 ttl 0 表示不入缓存，每次都真取
    cache: isOnceOnly(source) ? {} : { ttl: 0 },
    trigger: source.triggerLength ? "manual" : "load",
  };
}

/* ----------------------------- 运行时 ----------------------------- */

export interface LoadExternalOptions {
  /** provider 名；缺省 default */
  provider?: string;
  signal?: AbortSignal;
  onError?: (message: string, source: ExternalDataSource) => void;
}

/**
 * 加载单个外部数据源，结果写进 scope 的 response.scopePath。
 * 取数失败不抛错：保留原值，只通过 onError 上报，页面不会白屏。
 */
export async function loadExternalSource(
  source: ExternalDataSource,
  scope: Scope,
  options: LoadExternalOptions = {},
): Promise<unknown> {
  if (!source?.url) return undefined;

  const ctx: BindingContext = { scope };
  const binding = toDataBinding(source);

  try {
    const provider = getProvider(options.provider ?? "default");
    const result = await provider.load(binding, ctx);

    const scopePath = source.response?.scopePath;
    if (scopePath) setByPath(scope, scopePath, result);
    options.onError?.("", source);
    return result;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return undefined;
    const message = `外部数据源${source.name ? `「${source.name}」` : ""}加载失败：${(error as Error).message}`;
    options.onError?.(message, source);
    console.warn(`[web-design][external] ${message}`, error);
    return undefined;
  }
}

/* ----------------------------- 页面级遍历 ----------------------------- */

/** 遍历页面树，收集所有带外部数据源的节点 */
export function collectExternalSources(page: PageSchema): Array<{ node: NodeSchema; source: ExternalDataSource }> {
  const out: Array<{ node: NodeSchema; source: ExternalDataSource }> = [];
  const walk = (nodes: NodeSchema[]): void => {
    for (const node of nodes ?? []) {
      if (node.dataSource?.url) out.push({ node, source: node.dataSource });
      walk(node.children ?? []);
    }
  };
  walk(page.children ?? []);
  return out;
}

/** 页面里是否存在外部数据源（渲染器据此决定要不要挂触发监听） */
export function hasExternalSource(page: PageSchema): boolean {
  return collectExternalSources(page).length > 0;
}

/**
 * 加载页面里全部外部数据源。
 * 串行执行：同一页面通常只有一两个源，串行能避免并发写 scope 造成的顺序抖动。
 */
export async function loadExternalSources(
  page: PageSchema,
  scope: Scope,
  options: LoadExternalOptions = {},
): Promise<void> {
  const list = collectExternalSources(page);
  if (!list.length) return;

  for (const { source } of list) {
    // 触发型数据源（triggerLength > 0）不在这里加载：等用户输入够长度再触发
    if (Number(source.triggerLength ?? 0) > 0) continue;
    await loadExternalSource(source, scope, options);
  }
}

/** 读取某个路径上的当前值（触发判定用） */
export function readTriggerValue(scope: Scope, path?: string): unknown {
  if (!path) return undefined;
  return getByPath(scope, path);
}

/** 求值外部数据源的参数（设计器预览 / 运行时共用） */
export function resolveExternalParams(source: ExternalDataSource, scope: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of source.params ?? []) {
    if (!item?.key) continue;
    out[item.key] = item.path ? resolveValue(`{{${item.path}}}`, scope) : undefined;
  }
  return out;
}
