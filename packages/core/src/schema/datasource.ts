/**
 * 页面数据源取数（框架无关）。
 *
 * Vue 的 usePageScope 与 React 的 usePageStore 共用这一份实现，
 * 避免「同一份 Schema 在 Vue 会取数、在 React 不取数」这类分叉。
 *
 * 取数统一走 core 内置请求层（./request）：
 * - 缺省复用全局默认实例，应用层配的拦截器（鉴权 / 错误处理）自动生效；
 * - 测试 / SSR 仍可注入 fetchImpl（会建一个隔离实例，不污染全局默认实例）。
 */
import type { Scope } from "./expression";
import type { PageSchema } from "./types";
import type { FetchImpl, Method } from "../request/types";
import { request as defaultRequest, createRequest } from "../request";
import { deepClone } from "../utils/clone";

/** 兼容别名：底层 fetch 实现签名（来自 request 层） */
export type FetchLike = FetchImpl;

export interface LoadPageDataOptions {
  /** 自定义 fetch；缺省走 core 内置请求层（含拦截器）。注入后会建隔离实例，不污染全局默认实例 */
  fetchImpl?: FetchImpl;
  /** 取消信号；换页 / 卸载时由宿主 abort */
  signal?: AbortSignal;
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

/** 是否存在会自动发起的请求，供宿主决定 loading 初值 */
export function hasAutoHttpSource(page: PageSchema): boolean {
  return Object.values(page.dataSource ?? {}).some(
    (item) => item.type === "http" && item.auto !== false,
  );
}

/**
 * 把 dataSource 的结果写进 scope。
 * 取数失败不抛错：保留 scope 原值，只通过 onError 上报，页面不会白屏。
 */
export async function loadPageData(
  page: PageSchema,
  scope: Scope,
  options: LoadPageDataOptions = {},
): Promise<void> {
  const entries = Object.entries(page.dataSource ?? {});
  if (!entries.length) return;

  const req = options.fetchImpl
    ? createRequest({ defaults: { fetchImpl: options.fetchImpl } })
    : defaultRequest;

  options.onLoading?.(hasAutoHttpSource(page));

  for (const [key, item] of entries) {
    if (item.type === "static") {
      scope[key] = deepClone(item.data ?? {});
      continue;
    }
    if (item.type === "http" && item.auto === false) continue;
    if (!item.url) continue;

    try {
      const res = await req.request({
        url: item.url,
        method: (item.method ?? "GET") as Method,
        ...(item.method === "GET" ? { params: item.params } : { data: item.params }),
        signal: options.signal,
        responseType: "json",
      });
      scope[key] = res.data;
      options.onError?.("");
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      options.onError?.(`数据源 ${key} 加载失败：${(error as Error).message}`);
      console.warn(`[web-design][datasource] ${key} 加载失败`, error);
    }
  }

  options.onLoading?.(false);
}
