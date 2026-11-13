import type {
  Adapter,
  FetchImpl,
  NormalizedHeaders,
  RequestConfig,
  ResponseType,
  UploadProgressEvent,
  XacError,
  XacResponse,
} from "./types";

/* ----------------------------- URL / 参数 ----------------------------- */

export function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/** 拼接 baseURL 与 url（处理多余斜杠；url 为绝对地址时忽略 baseURL） */
export function combineURL(baseURL: string, url: string): string {
  if (!baseURL || isAbsoluteURL(url)) return url;
  const b = baseURL.replace(/\/+$/, "");
  const u = url.replace(/^\/+/, "");
  return `${b}/${u}`;
}

/** 把 params 拼到 url 后面（对象 → URLSearchParams，数组展开为同名多值） */
export function buildURL(url: string, params?: RequestConfig["params"]): string {
  if (!params) return url;
  let search: string;
  if (typeof params === "string") {
    search = params;
  } else if (params instanceof URLSearchParams) {
    search = params.toString();
  } else {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v == null) return;
      if (Array.isArray(v)) v.forEach((item) => usp.append(k, String(item)));
      else if (typeof v === "object") usp.append(k, JSON.stringify(v));
      else usp.append(k, String(v));
    });
    search = usp.toString();
  }
  if (!search) return url;
  const sep = url.includes("?") ? (url.endsWith("&") ? "" : "&") : "?";
  return `${url}${sep}${search}`;
}

/* ----------------------------- 头归一化 ----------------------------- */

export function normalizeHeaders(
  input?: Headers | Record<string, string> | string[][],
): NormalizedHeaders {
  const out: NormalizedHeaders = {};
  if (!input) return out;
  if (typeof Headers !== "undefined" && input instanceof Headers) {
    input.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
  } else if (Array.isArray(input)) {
    input.forEach(([k, v]) => {
      out[k.toLowerCase()] = v;
    });
  } else {
    Object.entries(input).forEach(([k, v]) => {
      out[k.toLowerCase()] = String(v);
    });
  }
  return out;
}

/* ----------------------------- 类型守卫 ----------------------------- */

function isFormDataLike(v: unknown): v is FormData {
  return typeof FormData !== "undefined" && v instanceof FormData;
}

function isBodyRaw(v: unknown): boolean {
  return (
    isFormDataLike(v) ||
    (typeof Blob !== "undefined" && v instanceof Blob) ||
    (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) ||
    (typeof URLSearchParams !== "undefined" && v instanceof URLSearchParams) ||
    typeof v === "string"
  );
}

/* ----------------------------- 错误构造 ----------------------------- */

export function createXacError(
  message: string,
  config?: RequestConfig,
  code?: string,
): XacError {
  const err = new Error(message) as XacError;
  err.isXacError = true;
  err.config = config;
  err.code = code;
  return err;
}

/* ----------------------------- fetch 适配器（默认） ----------------------------- */

function getFetchImpl(config: RequestConfig): FetchImpl {
  const impl = config.fetchImpl;
  if (impl) return impl;
  const g = globalThis.fetch as FetchImpl | undefined;
  if (!g) {
    throw createXacError(
      "globalThis.fetch is not available; please provide fetchImpl",
      config,
      "ERR_NO_FETCH",
    );
  }
  return g;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function parseBody(response: Response, responseType: ResponseType): Promise<unknown> {
  switch (responseType) {
    case "text":
      return response.text();
    case "blob":
      return response.blob();
    case "arraybuffer":
      return response.arrayBuffer();
    case "json":
    default: {
      const text = await response.text();
      if (!text) return null;
      return safeJson(text);
    }
  }
}

export const fetchAdapter: Adapter = async (config) => {
  const method = (config.method ?? "GET").toUpperCase();
  const fullURL = buildURL(combineURL(config.baseURL ?? "", config.url), config.params);
  const headers = normalizeHeaders(config.headers ?? {});

  let body: BodyInit | undefined;
  if (config.data !== undefined && method !== "GET" && method !== "HEAD") {
    if (isBodyRaw(config.data)) {
      body = config.data as BodyInit;
    } else {
      body = JSON.stringify(config.data);
      if (!headers["content-type"]) headers["content-type"] = "application/json";
    }
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise: Promise<never> | null =
    config.timeout && config.timeout > 0
      ? new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              createXacError(
                `timeout of ${config.timeout}ms exceeded`,
                config,
                "ECONNABORTED",
              ),
            );
          }, config.timeout);
        })
      : null;

  if (config.signal) {
    if (config.signal.aborted) controller.abort(config.signal.reason);
    else
      config.signal.addEventListener(
        "abort",
        () => controller.abort(config.signal!.reason),
        { once: true },
      );
  }

  const fetchImpl = getFetchImpl(config);
  const fetchPromise = fetchImpl(fullURL, {
    method,
    headers: new Headers(headers),
    body,
    signal: controller.signal,
    credentials: config.withCredentials ? "include" : "same-origin",
  });
  // 避免超时胜出后，被丢弃的 fetchPromise 后续 reject 成为未处理拒绝
  fetchPromise.catch(() => {});

  try {
    const response = await (timeoutPromise
      ? Promise.race([fetchPromise, timeoutPromise])
      : fetchPromise);
    const data = await parseBody(response as Response, config.responseType ?? "json");
    const result: XacResponse = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: normalizeHeaders(response.headers),
      config,
      request: response,
    };
    const ok = (config.validateStatus ?? ((s) => s >= 200 && s < 300))(
      response.status,
    );
    if (!ok) {
      const err = createXacError(
        `Request failed with status code ${response.status}`,
        config,
        "ERR_BAD_RESPONSE",
      );
      err.response = result;
      throw err;
    }
    return result;
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError") {
      const canceled = createXacError("Request aborted", config, "ERR_CANCELED");
      throw canceled;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/* ----------------------------- XHR 适配器（上传进度） ----------------------------- */

function parseXhrHeaders(raw: string): string[][] {
  const out: string[][] = [];
  raw.split(/[\r\n]+/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) out.push([line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()]);
  });
  return out;
}

export const xhrAdapter: Adapter = (config) => {
  return new Promise<XacResponse>((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(
        createXacError(
          "XMLHttpRequest is not available in this environment",
          config,
          "ERR_NO_XHR",
        ),
      );
      return;
    }
    const method = (config.method ?? "GET").toUpperCase();
    const fullURL = buildURL(combineURL(config.baseURL ?? "", config.url), config.params);
    const headers = normalizeHeaders(config.headers ?? {});
    const xhr = new XMLHttpRequest();
    xhr.open(method, fullURL, true);

    if (config.withCredentials) xhr.withCredentials = true;
    if (config.timeout && config.timeout > 0) xhr.timeout = config.timeout;

    const rt = config.responseType ?? "json";
    if (rt === "blob" || rt === "arraybuffer") xhr.responseType = rt;

    // FormData 不手动设 content-type，让浏览器自动带 boundary
    if (!(config.data instanceof FormData)) {
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }

    if (config.onUploadProgress && xhr.upload) {
      let lastLoaded = 0;
      let lastTime = Date.now();
      xhr.upload.onprogress = (e: ProgressEvent) => {
        const loaded = e.loaded;
        const total = e.total || 0;
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        const rate = dt > 0 ? (loaded - lastLoaded) / dt : undefined;
        lastLoaded = loaded;
        lastTime = now;
        const ev: UploadProgressEvent = {
          loaded,
          total,
          progress: total ? loaded / total : 0,
          rate,
        };
        config.onUploadProgress!(ev);
      };
    }

    if (config.signal) {
      if (config.signal.aborted) xhr.abort();
      else
        config.signal.addEventListener(
          "abort",
          () => xhr.abort(),
          { once: true },
        );
    }

    xhr.onload = () => {
      const respHeaders = normalizeHeaders(parseXhrHeaders(xhr.getAllResponseHeaders()));
      let data: unknown;
      if (rt === "blob" || rt === "arraybuffer") {
        data = xhr.response;
      } else {
        const text = xhr.responseText ?? "";
        data = rt === "json" ? (text ? safeJson(text) : null) : text;
      }
      const result: XacResponse = {
        data,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: respHeaders,
        config,
        request: xhr,
      };
      const ok = (config.validateStatus ?? ((s) => s >= 200 && s < 300))(
        xhr.status,
      );
      if (!ok) {
        const err = createXacError(
          `Request failed with status code ${xhr.status}`,
          config,
          "ERR_BAD_RESPONSE",
        );
        err.response = result;
        reject(err);
      } else {
        resolve(result);
      }
    };

    xhr.onerror = () => reject(createXacError("Network Error", config, "ERR_NETWORK"));
    xhr.ontimeout = () =>
      reject(
        createXacError(
          `timeout of ${config.timeout}ms exceeded`,
          config,
          "ECONNABORTED",
        ),
      );
    xhr.onabort = () => reject(createXacError("Request aborted", config, "ERR_CANCELED"));

    let body: BodyInit | undefined;
    if (config.data !== undefined && method !== "GET" && method !== "HEAD") {
      if (isBodyRaw(config.data)) body = config.data as BodyInit;
      else body = JSON.stringify(config.data);
    }
    xhr.send(body as XMLHttpRequestBodyInit | Document | null | undefined);
  });
};

/* ----------------------------- 适配器选择 ----------------------------- */

/**
 * 默认适配器选择逻辑：
 * - config.adapter 命中 → 直接用（高级自定义）。
 * - 需要上传进度且环境支持 XHR → 走 XHR（fetch 拿不到上传进度）。
 * - 其余 → fetch。
 */
export function defaultAdapter(config: RequestConfig): Promise<XacResponse> {
  if (config.adapter) return config.adapter(config);
  if (config.onUploadProgress && typeof XMLHttpRequest !== "undefined") {
    return xhrAdapter(config);
  }
  return fetchAdapter(config);
}
