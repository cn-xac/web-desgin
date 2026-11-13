import { resolveValue } from "../schema/expression";
import type { RequestConfig, RequestInstance, Method } from "../request/types";
import type {
  BindingContext,
  CacheConfig,
  DataBinding,
  DataProvider,
  ProviderConfig,
} from "./types";
import { normalize } from "./normalize";

/* ----------------------------- 参数绑定解析 ----------------------------- */

function mergeScope(ctx: BindingContext): BindingContext["scope"] {
  return { ...ctx.scope, ...(ctx.elementValues ?? {}) };
}

/** 递归解析 params 中的 {{path}} 绑定（复用 schema/expression 的 resolveValue） */
function resolveParams(
  params: Record<string, unknown> | undefined,
  ctx: BindingContext,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const scope = mergeScope(ctx);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = resolveValue(v, scope);
  }
  return out;
}

/* ----------------------------- 缓存（去重 + TTL） ----------------------------- */

interface CacheEntry {
  promise?: Promise<unknown>;
  value?: unknown;
  /** Infinity 表示页面级不过期（对应「只请求一次」） */
  expireAt: number;
}

function cacheKey(binding: DataBinding, resolved: Record<string, unknown> | undefined): string {
  return JSON.stringify({
    url: binding.url,
    method: binding.method ?? "GET",
    params: resolved ?? null,
    headers: binding.headers ?? null,
  });
}

/**
 * 按契约取数并归一化。
 *
 * - params 里的 {{path}} 绑定到 BindingContext；
 * - GET/HEAD 走 params（拼 query），其余走 data（JSON body）；
 * - 走 request 层（拦截器 / baseURL / 超时全部生效）；
 * - store 存在时启用并发去重 + 页面级 TTL 缓存；错误不写入缓存（不污染）。
 *
 * @param store 由 createProvider 按 provider 维度维护；传 undefined 则不做缓存。
 */
export function resolveBinding(
  binding: DataBinding,
  ctx: BindingContext,
  request: RequestInstance,
  cache: CacheConfig | undefined,
  store?: Map<string, CacheEntry>,
): Promise<unknown> {
  const resolved = resolveParams(binding.params, ctx);
  const method = ((binding.method ?? "GET") as string).toUpperCase() as Method;
  const isQuery = method === "GET" || method === "HEAD";

  const config: RequestConfig = {
    url: binding.url,
    method,
    headers: binding.headers,
    responseType: "json",
    ...(isQuery ? { params: resolved } : { data: resolved }),
  };

  const key = cacheKey(binding, resolved);
  const now = Date.now();

  // ttl = 0 表示「不入缓存、每次都真取」：既不去重也不落值。
  // ttl 缺省表示页面级不过期（对应 rg4KCt「只请求一次」）。
  const cacheable = cache?.ttl !== 0;

  if (store && cacheable) {
    const entry = store.get(key);
    if (entry) {
      // 命中有效值
      if (entry.value !== undefined && (entry.expireAt === Infinity || entry.expireAt > now)) {
        return Promise.resolve(entry.value);
      }
      // 同 key 在途请求：合并为一个，实现并发去重
      if (entry.promise) return entry.promise;
    }
  }

  const promise = (async () => {
    const res = await request.request(config);
    return normalize(binding, res.data, ctx);
  })();

  if (store && cacheable) {
    const ttl = cache?.ttl;
    store.set(key, { promise, expireAt: ttl && ttl > 0 ? now + ttl : Infinity });
    // 成功后落地 value、清除 in-flight；失败则移除该键（错误不污染缓存）
    promise.then(
      (v) => {
        const e = store.get(key);
        if (e) {
          e.value = v;
          e.promise = undefined;
        }
      },
      () => {
        store.delete(key);
      },
    );
  }

  return promise;
}

/* ----------------------------- Provider 工厂 ----------------------------- */

/**
 * 由 ProviderConfig 创建一个 DataProvider。
 * 每个 provider 维护自己独立的缓存 store（按 provider 维度去重 / 缓存）。
 */
export function createProvider(config: ProviderConfig): DataProvider {
  const store = new Map<string, CacheEntry>();
  return {
    load(binding: DataBinding, ctx: BindingContext): Promise<unknown> {
      // binding.cache 优先于 provider 级 cache
      const mergedCache: CacheConfig | undefined = binding.cache
        ? { ...(config.cache ?? {}), ...binding.cache }
        : config.cache;
      return resolveBinding(binding, ctx, config.request, mergedCache, store);
    },
  };
}
