/**
 * 页面数据源取数（框架无关）。
 *
 * Vue 的 usePageScope 与 React 的 usePageStore 共用这一份实现，
 * 避免「同一份 Schema 在 Vue 会取数、在 React 不取数」这类分叉。
 *
 * core 的约束是「副作用通过参数传入」：这里不直接持有 fetch，
 * 宿主可注入 fetchImpl（测试 / SSR / 拦截器都好接），缺省才取 globalThis.fetch。
 */
import type { Scope } from "./expression";
import type { PageSchema } from "./types";
import { deepClone } from "../utils/clone";

export type FetchLike = typeof fetch;

export interface LoadPageDataOptions {
  /** 自定义 fetch；缺省 globalThis.fetch（SSR 可注入自己的实现） */
  fetchImpl?: FetchLike;
  /** 取消信号；换页 / 卸载时由宿主 abort */
  signal?: AbortSignal;
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

/** 是否存在会自动发起的请求，供宿主决定 loading 初值 */
export function hasAutoHttpSource(page: PageSchema): boolean {
  return Object.values(page.dataSource ?? {}).some((item) => item.type === "http" && item.auto !== false);
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

  const fetchImpl: FetchLike = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  options.onLoading?.(hasAutoHttpSource(page));

  for (const [key, item] of entries) {
    if (item.type === "static") {
      scope[key] = deepClone(item.data ?? {});
      continue;
    }
    if (item.type === "http" && item.auto === false) continue;
    if (!item.url) continue;

    try {
      const response = await fetchImpl(item.url, {
        method: item.method ?? "GET",
        signal: options.signal,
        headers: item.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: item.method === "POST" ? JSON.stringify(item.params ?? {}) : undefined,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      scope[key] = await response.json();
      options.onError?.("");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      options.onError?.(`数据源 ${key} 加载失败：${(error as Error).message}`);
      console.warn(`[vue-design][datasource] ${key} 加载失败`, error);
    }
  }

  options.onLoading?.(false);
}
