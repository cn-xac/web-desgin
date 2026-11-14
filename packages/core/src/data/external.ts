/**
 * 外部数据源（对应待办 rg4KCt）。
 *
 * 定位：把一个 HTTP 接口配置成页面可消费的数据，能力覆盖
 * 「输入框 / 下拉选择等场景中作为数据来源使用」。
 *
 * 三条设计约束（决定了下面的实现形状）：
 *
 * 1. **配置集中在页面级**（page.externalSources，键为 id），节点只用 `externalRef` 引用。
 *    既避免同一份取数配置在多个元素上重复书写，也让「一个源喂多个元素」天然成立；
 *    响应映射各自写不同 scope 路径即可，与既有表达式机制同构。
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
import { normalize } from "./normalize";

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

/** 响应数据映射（一条） */
export interface ExternalResponseMap {
  /** 结果写入 scope 的路径。映射到某个元素时 = 该元素的绑定路径 */
  scopePath: string;
  /** 从响应里取出数组的字段名（如 data.list） */
  listField?: string;
  /** 选项形态：label 取值字段（缺省 label） */
  labelField?: string;
  /** 选项形态：value 取值字段（缺省 value；选项数据源缺省则回退到 label） */
  valueField?: string;
  /** 归一化形态；缺省由目标元素类型推断（选项类 → select，否则 form） */
  shape?: DataShape;
}

export interface ExternalDataSource {
  /** 数据源唯一 id（页面级 externalSources 的键）；由设计器生成，运行时按 id 反查触发节点 */
  id: string;
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
  /**
   * 响应数据映射（可多条，#4）。
   * 每条各自写不同的 scope 路径，形态 / label / value 独立，
   * 例如一条写 `external.deptList`（选项），一条写 `external.summary`（整段对象）。
   */
  responses?: ExternalResponseMap[];
  /**
   * @deprecated 旧版单条响应映射，仅供读取早期 Schema 时兼容。
   * 新写入一律走 `responses` 数组；`responsesOf()` 会自动把本条提升为数组。
   */
  response?: ExternalResponseMap;
  /**
   * 标记本数据源是「选项数据源」（#5）：响应恒为选项形态，由下拉 / 单选等元素直接消费，
   * 不再需要逐条选响应形态；仅配置 label / value 映射即可。
   */
  asOptions?: boolean;
  /** 只请求一次（当前页面仅请求一次）；缺省 true */
  once?: boolean;
  /** 触发长度：输入达到该长度才发请求；0 / 缺省 = 页面加载即取 */
  triggerLength?: number;
  /**
   * @deprecated 触发元素固定为「绑定该源的节点」，运行时按该节点自身的绑定路径取触发值；
   * 此字段仅保留兼容旧 Schema，新配置不再写入。
   */
  triggerPath?: string;
}

/**
 * 兼容读取响应映射：新结构用 `responses` 数组；旧结构单条 `response` 自动提升为数组。
 * 既支持本次重构后的多响应，也不至于让早期 Schema 直接失效。
 */
export function responsesOf(source: ExternalDataSource | undefined): ExternalResponseMap[] {
  if (!source) return [];
  if (Array.isArray(source.responses)) {
    return source.responses.filter((item): item is ExternalResponseMap => Boolean(item?.scopePath));
  }
  if (source.response?.scopePath) return [source.response];
  return [];
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

/**
 * 把外部数据源翻译成 core 的 DataBinding。
 *
 * 关键决策：binding 一律取「原始响应」（shape = 'form'），参数的 {{}} 绑定照常解析；
 * 各响应映射的「选项 / 表单」形态、label / value / listField 归一化，
 * 放到 loadExternalSource 里按每条响应分别做（见 normalizeResponse）。
 * 这样多条响应（各自不同形态）可以共用同一次缓存请求，互不干扰。
 */
export function toDataBinding(source: ExternalDataSource): DataBinding {
  const params: Record<string, unknown> = {};
  for (const item of source.params ?? []) {
    if (!item?.key) continue;
    params[item.key] = item.path ? `{{${item.path}}}` : "";
  }

  return {
    type: "http",
    url: source.url,
    method: source.method ?? "GET",
    headers: source.headers,
    params,
    // 原始响应：各响应的形态在 loadExternalSource 内分别归一化
    shape: "form",
    // 「只请求一次」= 不过期；否则 ttl 0 表示不入缓存，每次都真取
    cache: isOnceOnly(source) ? {} : { ttl: 0 },
    trigger: source.triggerLength ? "manual" : "load",
  };
}

/**
 * 按单条响应配置把「原始响应」归一化为目标形态。
 * - shape = 'form'：原样返回（已转换后的对象）；
 * - 选项形态（select/radio/checkbox）：经 listField 取数组，再按 label/value 映射。
 *
 * valueField 缺省时的回退规则：
 * - 选项数据源（asOptions，#5）：未配值字段 → 值默认等于名称（label）；
 * - 其它外部数据源：沿用通用约定，值默认取对象的 value 字段。
 */
function normalizeResponse(raw: unknown, response: ExternalResponseMap, fallbackValueToLabel: boolean): unknown {
  const labelField = response.labelField ?? "label";
  const valueField = response.valueField || (fallbackValueToLabel ? labelField : "value");
  const binding: DataBinding = {
    type: "http",
    url: "",
    shape: response.shape ?? "form",
    listField: response.listField,
    labelField,
    valueField,
  };
  return normalize(binding, raw, { scope: {} });
}

/* ----------------------------- 运行时 ----------------------------- */

export interface LoadExternalOptions {
  /** provider 名；缺省 default */
  provider?: string;
  signal?: AbortSignal;
  onError?: (message: string, source: ExternalDataSource) => void;
}

/**
 * 加载单个外部数据源。
 *
 * 流程：先取一次原始响应（走参数 {{}} 绑定 + 页面级缓存），再按 `responses` 里每条响应
 * 各自的 shape / labelField / valueField / listField 归一化，分别写进各自的 scopePath。
 * 取数失败不抛错：保留原值，只通过 onError 上报，页面不会白屏。
 *
 * 若未配置任何响应映射（#2：不需要绑定元素），仍会发起请求（例如仅用于「触发 / 写副作用」），
 * 但不向 scope 写任何数据。
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
    const raw = await provider.load(binding, ctx);

    for (const response of responsesOf(source)) {
      const mapped = normalizeResponse(raw, response, Boolean(source.asOptions));
      setByPath(scope, response.scopePath, mapped);
    }
    options.onError?.("", source);
    return raw;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return undefined;
    const message = `外部数据源${source.name ? `「${source.name}」` : ""}加载失败：${(error as Error).message}`;
    options.onError?.(message, source);
    console.warn(`[web-design][external] ${message}`, error);
    return undefined;
  }
}

/* ----------------------------- 页面级遍历 ----------------------------- */

/** 反查「触发 / 拥有」某条页面级外部数据源的节点（externalRef === source.id） */
function findTriggerNode(page: PageSchema, sourceId: string): NodeSchema | undefined {
  let found: NodeSchema | undefined;
  const walk = (nodes: NodeSchema[]): void => {
    for (const node of nodes ?? []) {
      if (node.externalRef === sourceId) {
        found = node;
        return;
      }
      walk(node.children ?? []);
      if (found) return;
    }
  };
  walk(page.children ?? []);
  return found;
}

/**
 * 遍历页面级外部数据源，返回每条 { node, source }。
 * node 为「触发 / 拥有」该源的节点（externalRef === source.id），运行时据此按节点解析默认触发路径；
 * 找不到触发节点时为 undefined（此时触发路径必须显式配置）。
 */
export function collectExternalSources(
  page: PageSchema,
): Array<{ node: NodeSchema | undefined; source: ExternalDataSource }> {
  const out: Array<{ node: NodeSchema | undefined; source: ExternalDataSource }> = [];
  for (const source of Object.values(page.externalSources ?? {})) {
    if (!source?.url) continue;
    out.push({ node: findTriggerNode(page, source.id), source });
  }
  return out;
}

/** 页面里是否存在外部数据源（渲染器据此决定要不要挂触发监听） */
export function hasExternalSource(page: PageSchema): boolean {
  return Object.values(page.externalSources ?? {}).some((s) => Boolean(s?.url));
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
