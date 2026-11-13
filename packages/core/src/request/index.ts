import { RequestClient } from "./client";
import type { RequestDefaults, RequestInstance } from "./types";

export * from "./types";
export * from "./interceptor";
export * from "./adapter";
export { RequestClient, mergeConfig } from "./client";

export interface CreateRequestOptions {
  defaults?: Partial<RequestDefaults>;
}

/** 工厂：创建一个隔离的请求客户端实例（各自独立维护拦截器与默认值） */
export function createRequest(options?: CreateRequestOptions): RequestInstance {
  return new RequestClient(options);
}

/**
 * core 内置的全局默认实例：所有 URL 请求建议统一走它，
 * 便于在应用启动时集中配置 baseURL / 鉴权拦截器 / 错误处理拦截器。
 */
export const request: RequestInstance = createRequest();

/** request 的别名，语义化可读性更好 */
export const http: RequestInstance = request;
