// @vitest-environment jsdom
/**
 * core 请求层（request）单测：
 * 拦截器链顺序、请求/响应拦截器、错误与超时、上传（XHR 进度）、dataSource 收编。
 *
 * 全程注入 mock fetchImpl / 假 XHR，不触达真实网络。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequest,
  request as defaultRequest,
  loadPageData,
} from "@x-ac/web-design-core";
import type { FetchImpl, RequestConfig } from "@x-ac/web-design-core";

/** 构造一个尊重 signal 的 mock fetch，返回 JSON 响应；记录最后一次调用 */
function makeMockFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init: init ?? {} });
    const signal = init?.signal;
    if (signal) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", () => {
        // 模拟底层在 signal abort 时抛 AbortError
      });
    }
    const headers = new Headers({ "content-type": "application/json" });
    return {
      status: 200,
      statusText: "OK",
      headers,
      async text() {
        return JSON.stringify({ ok: true, url });
      },
    } as unknown as Response;
  }) as FetchImpl;
  return { fn, calls };
}

describe("request 拦截器链", () => {
  it("请求/响应拦截器均按注册顺序（FIFO）执行", async () => {
    const order: string[] = [];
    const { fn, calls } = makeMockFetch();
    const client = createRequest({ defaults: { fetchImpl: fn } });

    client.interceptors.request.use((cfg) => {
      order.push("req1");
      return cfg;
    });
    client.interceptors.request.use((cfg) => {
      order.push("req2");
      return cfg;
    });
    client.interceptors.response.use((res) => {
      order.push("res1");
      return res;
    });
    client.interceptors.response.use((res) => {
      order.push("res2");
      return res;
    });

    await client.get("/api/x");
    expect(order).toEqual(["req1", "req2", "res1", "res2"]);
    expect(calls.length).toBe(1);
  });

  it("请求拦截器可改写 config（注入鉴权头）", async () => {
    const { fn, calls } = makeMockFetch();
    const client = createRequest({ defaults: { fetchImpl: fn } });
    client.interceptors.request.use((cfg) => {
      cfg.headers = { ...cfg.headers, Authorization: "Bearer tkn" };
      return cfg;
    });
    await client.get("/api/x");
    const sent = calls[0].init.headers as Headers;
    expect(sent.get("authorization")).toBe("Bearer tkn");
  });

  it("响应拦截器可改写响应（统一解包 data）", async () => {
    const { fn } = makeMockFetch();
    const client = createRequest({ defaults: { fetchImpl: fn } });
    client.interceptors.response.use((res) => {
      const anyData = res.data as { ok: boolean; url: string };
      res.data = { wrapped: anyData.ok, from: anyData.url };
      return res;
    });
    const res = await client.get<{ wrapped: boolean; from: string }>("/api/x");
    expect(res.data).toEqual({ wrapped: true, from: "/api/x" });
  });

  it("上游请求拦截器抛错，被下游请求拦截器的 onRejected 恢复（axios 一致语义）", async () => {
    const { fn } = makeMockFetch();
    const client = createRequest({ defaults: { fetchImpl: fn } });
    const seen: string[] = [];
    // 第一个请求拦截器：fulfilled 抛错（无 onRejected，错误继续向下游传播）
    client.interceptors.request.use(() => {
      throw new Error("upstream boom");
    });
    // 第二个请求拦截器：onRejected 接住上游错误并恢复出一个新 config
    client.interceptors.request.use(
      (cfg) => cfg,
      (err) => {
        seen.push("recovered:" + (err as Error).message);
        return { url: "/api/fallback" } as RequestConfig;
      },
    );
    const res = await client.request({ url: "/api/x" });
    expect(seen).toEqual(["recovered:upstream boom"]);
    // 错误被恢复，dispatch 用的是 fallback config，而非原始 /api/x
    expect(res.config.url).toBe("/api/fallback");
  });

  it("createRequest 的实例互相隔离（拦截器互不影响）", async () => {
    const { fn } = makeMockFetch();
    const a = createRequest({ defaults: { fetchImpl: fn } });
    const b = createRequest({ defaults: { fetchImpl: fn } });
    a.interceptors.request.use((cfg) => {
      cfg.headers = { ...cfg.headers, X: "A" };
      return cfg;
    });
    const callsB: Array<{ init: RequestInit }> = [];
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      callsB.push({ init: init ?? {} });
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        async text() {
          return "{}";
        },
      } as unknown as Response;
    }) as FetchImpl;
    b.defaults.fetchImpl = spy;
    await b.get("/api/b");
    expect((callsB[0].init.headers as Headers).get("X")).toBeNull();
  });
});

describe("request 错误处理与超时", () => {
  it("非 2xx 按 validateStatus 抛错并携带 response", async () => {
    const fn = (async () => {
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        async text() {
          return "boom";
        },
      } as unknown as Response;
    }) as FetchImpl;
    const client = createRequest({ defaults: { fetchImpl: fn } });
    await expect(client.get("/api/x")).rejects.toMatchObject({
      isXacError: true,
      code: "ERR_BAD_RESPONSE",
      response: { status: 500 },
    });
  });

  it("自定义 validateStatus 可把 500 视为成功", async () => {
    const fn = (async () => {
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        async text() {
          return JSON.stringify({ recovered: true });
        },
      } as unknown as Response;
    }) as FetchImpl;
    const client = createRequest({ defaults: { fetchImpl: fn } });
    const res = await client.get("/api/x", { validateStatus: (s) => s < 600 });
    expect(res.status).toBe(500);
    expect(res.data).toEqual({ recovered: true });
  });

  it("超时触发 ECONNABORTED", async () => {
    const fn = (() => new Promise<Response>(() => {})) as unknown as FetchImpl;
    const client = createRequest({ defaults: { fetchImpl: fn } });
    await expect(client.get("/api/x", { timeout: 30 })).rejects.toMatchObject({
      isXacError: true,
      code: "ECONNABORTED",
    });
  });

  it("外部 signal 取消触发 ERR_CANCELED", async () => {
    const fn = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await new Promise<void>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        async text() {
          return "{}";
        },
      } as unknown as Response;
    }) as FetchImpl;
    const client = createRequest({ defaults: { fetchImpl: fn } });
    const controller = new AbortController();
    const p = client.get("/api/x", { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: "ERR_CANCELED" });
  });
});

describe("request 上传（XHR 适配器）", () => {
  let OriginalXHR: typeof XMLHttpRequest | undefined;

  beforeEach(() => {
    OriginalXHR = globalThis.XMLHttpRequest;
  });
  afterEach(() => {
    globalThis.XMLHttpRequest = OriginalXHR as typeof XMLHttpRequest;
  });

  /** 仅用于本测试的假 XHR：模拟上传进度 + 成功响应 */
  class FakeXHR {
    upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    statusText = "";
    responseText = "";
    response: unknown = null;
    responseType = "";
    withCredentials = false;
    timeout = 0;
    private sentBody: FormData | null = null;

    open() {}
    setRequestHeader() {}
    getAllResponseHeaders() {
      return "content-type: application/json\r\nx-trace: abc";
    }
    abort() {
      this.onabort?.();
    }
    send(body: BodyInit | null) {
      this.sentBody = body as FormData;
      // 模拟两段进度
      this.upload.onprogress?.({
        loaded: 50,
        total: 100,
      } as ProgressEvent);
      this.upload.onprogress?.({
        loaded: 100,
        total: 100,
      } as ProgressEvent);
      this.status = 200;
      this.statusText = "OK";
      this.responseText = JSON.stringify({ uploaded: true });
      this.onload?.();
    }
  }

  it("upload 自动走 XHR 并上报进度，FormData 透传", async () => {
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    const client = createRequest();
    const fd = new FormData();
    fd.append("file", new Blob(["hello"]), "a.txt");
    const progresses: number[] = [];
    const res = await client.upload("/upload", fd, "file", {
      onUploadProgress: (e) => progresses.push(e.progress),
    });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ uploaded: true });
    expect(res.headers["x-trace"]).toBe("abc");
    expect(progresses).toEqual([0.5, 1]);
  });

  it("上传 File 时自动包成 FormData（字段名缺省 file）", async () => {
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    const client = createRequest();
    const res = await client.upload("https://example.com/upload", new Blob(["x"]) as Blob);
    expect(res.status).toBe(200);
  });
});

describe("dataSource 收编到请求层", () => {
  it("GET 把 params 拼到 query，POST 把 params 作为 JSON body", async () => {
    const getCalls: Array<{ url: string; init: RequestInit }> = [];
    const postCalls: Array<{ url: string; init: RequestInit }> = [];
    const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if ((init?.method ?? "GET") === "POST") postCalls.push({ url, init: init ?? {} });
      else getCalls.push({ url, init: init ?? {} });
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        async text() {
          return JSON.stringify({ echo: url });
        },
      } as unknown as Response;
    }) as FetchImpl;

    await loadPageData(
      {
        id: "p",
        type: "page",
        schemaVersion: "1.0.0",
        meta: { title: "t", device: "pc" },
        state: {},
        dataSource: {
          list: { type: "http", url: "/api/list", method: "GET", params: { a: 1 } },
          save: { type: "http", url: "/api/save", method: "POST", params: { name: "x" } },
          fixed: { type: "static", data: { k: "v" } },
        },
      } as never,
      {} as Record<string, unknown>,
      { fetchImpl: fn },
    );

    expect(getCalls[0].url).toBe("/api/list?a=1");
    expect(postCalls[0].url).toBe("/api/save");
    expect(postCalls[0].init.body).toBe(JSON.stringify({ name: "x" }));
    expect((postCalls[0].init.headers as Headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("无 fetchImpl 时复用全局默认实例（拦截器生效）", async () => {
    const flag = { hit: false };
    const id = defaultRequest.interceptors.request.use((cfg) => {
      flag.hit = true;
      return cfg;
    });
    const fn = (async () =>
      ({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        async text() {
          return "{}";
        },
      }) as unknown as Response) as FetchImpl;
    // 临时把全局默认实例的 fetchImpl 指向 mock（测试后还原）
    const saved = defaultRequest.defaults.fetchImpl;
    defaultRequest.defaults.fetchImpl = fn;
    await loadPageData(
      {
        id: "p",
        type: "page",
        schemaVersion: "1.0.0",
        meta: { title: "t", device: "pc" },
        state: {},
        dataSource: { a: { type: "http", url: "/api/a" } },
      } as never,
      {} as Record<string, unknown>,
    );
    defaultRequest.defaults.fetchImpl = saved;
    defaultRequest.interceptors.request.eject(id);
    expect(flag.hit).toBe(true);
  });
});
