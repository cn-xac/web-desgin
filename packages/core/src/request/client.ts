import { InterceptorManagerImpl } from "./interceptor";
import { defaultAdapter, xhrAdapter } from "./adapter";
import type {
  Adapter,
  Method,
  RequestConfig,
  RequestDefaults,
  RequestInstance,
  XacResponse,
} from "./types";

function mergeHeaders(
  a: Record<string, string>,
  b?: Record<string, string>,
): Record<string, string> {
  return { ...a, ...(b ?? {}) };
}

/** 合并实例默认值与本次 config（headers 浅合并，其余本次优先；fetchImpl / baseURL 等显式兜底） */
export function mergeConfig(defaults: RequestDefaults, config: RequestConfig): RequestConfig {
  return {
    ...defaults,
    ...config,
    baseURL: config.baseURL ?? defaults.baseURL,
    method: (config.method ?? defaults.method) as Method,
    headers: mergeHeaders(defaults.headers, config.headers),
    timeout: config.timeout ?? defaults.timeout,
    responseType: config.responseType ?? defaults.responseType,
    withCredentials: config.withCredentials ?? defaults.withCredentials,
    fetchImpl: config.fetchImpl ?? defaults.fetchImpl,
  };
}

function defaultRejected(error: unknown): never {
  throw error;
}

export interface RequestClientOptions {
  defaults?: Partial<RequestDefaults>;
}

/**
 * 统一请求客户端（axios 风格）：
 * - interceptors.request / interceptors.response 可插拔；
 * - 请求拦截器「注册顺序」执行（FIFO，区别于 axios 的逆序）；
 * - 默认发请求走 defaultAdapter（fetch / XHR 自动选择）。
 */
export class RequestClient implements RequestInstance {
  defaults: RequestDefaults;
  interceptors: {
    request: InterceptorManagerImpl<RequestConfig>;
    response: InterceptorManagerImpl<XacResponse>;
  };

  constructor(options: RequestClientOptions = {}) {
    this.defaults = {
      baseURL: "",
      method: "GET",
      headers: {},
      timeout: 0,
      responseType: "json",
      withCredentials: false,
      fetchImpl: undefined,
      ...options.defaults,
    };
    this.interceptors = {
      request: new InterceptorManagerImpl<RequestConfig>(),
      response: new InterceptorManagerImpl<XacResponse>(),
    };
  }

  request<T = unknown>(config: RequestConfig): Promise<XacResponse<T>> {
    const merged = mergeConfig(this.defaults, config);

    // 拦截器链构造（均按「注册顺序 / FIFO」）：
    // 1) 先压入请求拦截器（在 dispatch 之前改写 config）；
    // 2) 再压入真正的发请求 [dispatch, rejected]；
    // 3) 最后压入响应拦截器（在 dispatch 之后改写响应）。
    // 链上函数入参随阶段在 RequestConfig / XacResponse 间切换，用 any 收口（运行时由调度保证类型正确）。
    const noop = (() => undefined) as (v: any) => any;
    const chain: Array<(v: any) => any> = [];
    this.interceptors.request.forEach((h) =>
      chain.push(h.fulfilled as (v: any) => any, (h.rejected ?? defaultRejected) as (v: any) => any),
    );
    chain.push(this.dispatch.bind(this) as (v: any) => any, noop);
    this.interceptors.response.forEach((h) =>
      chain.push(h.fulfilled as (v: any) => any, (h.rejected ?? defaultRejected) as (v: any) => any),
    );

    let promise: Promise<unknown> = Promise.resolve(merged);
    while (chain.length) {
      promise = promise.then(chain.shift()!, chain.shift()!);
    }
    return promise as Promise<XacResponse<T>>;
  }

  private async dispatch(config: RequestConfig): Promise<XacResponse> {
    // 拦截器（尤其是 onRejected 恢复路径）可能返回一个不完整的 config，
    // 这里把实例默认值做一次「缺失回填」，让 baseURL / 超时 / fetchImpl / 默认头
    // 对拦截器返回的 config 保持粘性（比 axios 更稳健，避免默认值被抹掉）。
    const merged: RequestConfig = {
      ...this.defaults,
      ...config,
      headers: { ...this.defaults.headers, ...(config.headers ?? {}) },
      fetchImpl: config.fetchImpl ?? this.defaults.fetchImpl,
      baseURL: config.baseURL ?? this.defaults.baseURL,
      method: config.method ?? this.defaults.method,
      timeout: config.timeout ?? this.defaults.timeout,
      responseType: config.responseType ?? this.defaults.responseType,
      withCredentials: config.withCredentials ?? this.defaults.withCredentials,
      adapter: config.adapter ?? this.defaults.adapter,
    };
    const adapter: Adapter = merged.adapter ?? defaultAdapter;
    return adapter(merged);
  }

  get<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "GET" });
  }
  post<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "POST", data });
  }
  put<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "PUT", data });
  }
  patch<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "PATCH", data });
  }
  delete<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "DELETE" });
  }
  head<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "HEAD" });
  }
  options<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...(config ?? {}), url, method: "OPTIONS" });
  }

  upload<T = unknown>(
    url: string,
    data: FormData | File | Blob,
    fieldName = "file",
    config?: Partial<RequestConfig>,
  ) {
    const body: FormData =
      data instanceof FormData
        ? data
        : (() => {
            const fd = new FormData();
            fd.append(fieldName, data as Blob);
            return fd;
          })();
    // 上传统一走 XHR 适配器：既能发 FormData，也能在需要时上报进度；
    // fetch 无法监听上传进度，故不交给默认选择器。
    return this.request<T>({
      ...(config ?? {}),
      url,
      method: "POST",
      data: body,
      onUploadProgress: config?.onUploadProgress,
      adapter: xhrAdapter,
    });
  }
}
