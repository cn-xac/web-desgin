/**
 * 框架无关的统一请求层类型（借鉴 axios 的拦截器链 + 上传能力）。
 *
 * 与 core 一致的约束：
 * - 不访问 window / document；fetch / AbortController / XMLHttpRequest 一律走全局（Node18+ 与浏览器均内置）。
 * - 底层 fetch 实现通过 defaults.fetchImpl 注入，缺省取 globalThis.fetch，便于测试 / SSR / 替换适配器。
 */

/** 底层 fetch 实现签名（与全局 fetch 一致，可注入） */
export type FetchImpl = typeof globalThis.fetch;

export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type ResponseType = "json" | "text" | "blob" | "arraybuffer";

/** 上传进度回调载荷 */
export interface UploadProgressEvent {
  loaded: number;
  total: number;
  /** 0~1 进度比 */
  progress: number;
  /** 近似上传速度（字节/秒） */
  rate?: number;
}

/** 归一化后的响应头（全部小写 key 的纯对象，便于读取，规避大小写差异） */
export type NormalizedHeaders = Record<string, string>;

export interface RequestConfig {
  url: string;
  method?: Method;
  /** 基础地址，与 url 拼接（url 为绝对地址时忽略 baseURL） */
  baseURL?: string;
  /** 查询参数（GET 拼到 URL；POST/PUT 等也可带） */
  params?: Record<string, unknown> | URLSearchParams | string;
  /** 请求体：普通对象会按 JSON 序列化；FormData / Blob / string 原样发送 */
  data?: unknown;
  headers?: NormalizedHeaders;
  /** 超时毫秒；0 表示不超时 */
  timeout?: number;
  /** 取消信号（与 timeout 自动合并） */
  signal?: AbortSignal;
  /** 响应解析方式，缺省 json */
  responseType?: ResponseType;
  /** 自定义是否视为成功（缺省 2xx） */
  validateStatus?: (status: number) => boolean;
  /** 自定义底层 fetch（覆盖 defaults.fetchImpl） */
  fetchImpl?: FetchImpl;
  /** 上传进度（设置后自动切换 XHR 适配器以拿到进度） */
  onUploadProgress?: (event: UploadProgressEvent) => void;
  /** 凭证策略，缺省 same-origin */
  withCredentials?: boolean;
  /** 完全自定义适配器（高级用法，覆盖默认选择逻辑） */
  adapter?: Adapter;
  /** 任意业务透传字段 */
  meta?: Record<string, unknown>;
}

/** 归一化后的统一响应结构 */
export interface XacResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: NormalizedHeaders;
  config: RequestConfig;
  /** 底层原生对象（fetch 的 Response / XHR 实例），便于调试 */
  request: unknown;
}

/** 拦截器错误：携带响应 / 配置，便于响应拦截器统一处理 */
export interface XacError extends Error {
  config?: RequestConfig;
  response?: XacResponse;
  request?: unknown;
  code?: string;
  isXacError: true;
}

export type Fulfilled<V, R = V> = (value: V) => R | Promise<R>;
export type Rejected = (error: unknown) => unknown;

export interface Interceptor<V, R = V> {
  fulfilled: Fulfilled<V, R>;
  rejected?: Rejected;
}

/** 请求拦截器：入参/出参都是 RequestConfig */
export type RequestInterceptor = Interceptor<RequestConfig>;
/** 响应拦截器：入参/出参都是 XacResponse */
export type ResponseInterceptor = Interceptor<XacResponse>;

/** 适配器：把归一化后的 config 变成响应（或抛错） */
export type Adapter = (config: RequestConfig) => Promise<XacResponse>;

/** createRequest 的可配置项（实例级默认值） */
export interface RequestDefaults
  extends Omit<
    RequestConfig,
    "url" | "method" | "data" | "params" | "signal" | "onUploadProgress"
  > {
  baseURL: string;
  method: Method;
  headers: NormalizedHeaders;
  timeout: number;
  responseType: ResponseType;
  withCredentials: boolean;
  fetchImpl?: FetchImpl;
}

/** 对外暴露的请求客户端接口 */
export interface RequestInstance {
  defaults: RequestDefaults;
  interceptors: {
    request: InterceptorManager<RequestConfig>;
    response: InterceptorManager<XacResponse>;
  };
  request<T = unknown>(config: RequestConfig): Promise<XacResponse<T>>;
  get<T = unknown>(url: string, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  patch<T = unknown>(url: string, data?: unknown, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  delete<T = unknown>(url: string, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  head<T = unknown>(url: string, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  options<T = unknown>(url: string, config?: Partial<RequestConfig>): Promise<XacResponse<T>>;
  /**
   * 上传：data 为 FormData / File / Blob。
   * - File / Blob 会自动包成 FormData（字段名 fieldName，缺省 "file"）。
   * - 自动走 XHR 适配器以拿到上传进度（fetch 无法监听上传进度）。
   */
  upload<T = unknown>(
    url: string,
    data: FormData | File | Blob,
    fieldName?: string,
    config?: Partial<RequestConfig>,
  ): Promise<XacResponse<T>>;
}

/** 拦截器管理器类型前向声明（具体实现见 ./interceptor） */
export interface InterceptorManager<V, R = V> {
  use(fulfilled: Fulfilled<V, R>, rejected?: Rejected): number;
  eject(id: number): void;
  clear(): void;
  forEach(fn: (handler: { fulfilled: Fulfilled<V, R>; rejected?: Rejected }) => void): void;
}
