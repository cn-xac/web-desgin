import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createRequest,
  setDefaultRequest,
  getDefaultRequest,
  registerProvider,
  getProvider,
  getProviderConfig,
  loadData,
  normalize,
  type DataBinding,
  type BindingContext,
} from "@x-ac/web-design-core";

/** 构造一个符合 request 层解析要求的假响应（request 用 text()+JSON.parse 取 body） */
function mockResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function fakeFetch(handler: (input: string, init?: RequestInit) => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  ) as unknown as typeof fetch;
}

const ctx = (scope: Record<string, unknown> = {}): BindingContext => ({ scope });

beforeEach(() => {
  // 安全默认：避免测试里误用 globalThis.fetch（node 下相对 URL 会炸）
  setDefaultRequest(
    createRequest({ defaults: { fetchImpl: fakeFetch(() => mockResponse([])) } }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalize：响应形态归一化", () => {
  it("选项形态按 labelField/valueField 映射，value 强制转 string", () => {
    const binding: DataBinding = {
      type: "http",
      url: "/x",
      shape: "select",
      labelField: "name",
      valueField: "id",
    };
    const out = normalize(binding, [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ], ctx()) as Array<{ label: string; value: string }>;
    expect(out).toEqual([
      { label: "A", value: "1" },
      { label: "B", value: "2" },
    ]);
  });

  it("listField 从包裹结构取出数组", () => {
    const binding: DataBinding = { type: "http", url: "/x", shape: "select", listField: "data" };
    const out = normalize(binding, { code: 0, data: [{ label: "a", value: "b" }] }, ctx()) as unknown[];
    expect(out).toEqual([{ label: "a", value: "b" }]);
  });

  it("transform 兜底任意结构", () => {
    const binding: DataBinding = {
      type: "http",
      url: "/x",
      shape: "select",
      transform: (raw) => [{ label: (raw as { k: unknown }).k, value: (raw as { v: unknown }).v }],
    };
    const out = normalize(binding, { k: "x", v: 1 }, ctx()) as unknown[];
    expect(out).toEqual([{ label: "x", value: "1" }]);
  });

  it("form 形态原样返回", () => {
    const binding: DataBinding = { type: "http", url: "/x", shape: "form" };
    expect(normalize(binding, { a: 1 }, ctx())).toEqual({ a: 1 });
  });

  it("非数组响应降级为空列表，不抛错", () => {
    const binding: DataBinding = { type: "http", url: "/x", shape: "select" };
    expect(normalize(binding, { foo: "bar" }, ctx())).toEqual([]);
  });
});

describe("resolveBinding / provider：参数绑定 + 取数", () => {
  it("params 里的 {{path}} 绑定到 scope，并拼成 GET query", async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch((input) => {
      calls.push(input);
      return mockResponse([{ label: "a", value: "b" }]);
    });
    registerProvider("bind", { request: createRequest({ defaults: { fetchImpl } }) });

    const binding: DataBinding = {
      type: "http",
      url: "/api/list",
      params: { q: "{{k}}", fixed: 5 },
    };
    await getProvider("bind").load(binding, ctx({ k: "v" }));
    expect(calls[0]).toContain("q=v");
    expect(calls[0]).toContain("fixed=5");
  });

  it("POST 把 params 作为 JSON body 发送", async () => {
    let body = "";
    const fetchImpl = fakeFetch((_input, init) => {
      body = String(init?.body ?? "");
      return mockResponse({ ok: true });
    });
    registerProvider("post", { request: createRequest({ defaults: { fetchImpl } }) });

    const binding: DataBinding = {
      type: "http",
      url: "/api/save",
      method: "POST",
      params: { name: "张三" },
    };
    const out = await getProvider("post").load(binding, ctx());
    expect(body).toContain('"name":"张三"');
    expect(out).toEqual({ ok: true });
  });

  it("并发相同请求只发一次（去重）", async () => {
    let count = 0;
    const fetchImpl = fakeFetch(() => {
      count += 1;
      return mockResponse([1, 2]);
    });
    registerProvider("dedup", { request: createRequest({ defaults: { fetchImpl } }) });

    const binding: DataBinding = { type: "http", url: "/x", shape: "select" };
    const [a, b] = await Promise.all([
      getProvider("dedup").load(binding, ctx()),
      getProvider("dedup").load(binding, ctx()),
    ]);
    expect(count).toBe(1);
    expect(a).toEqual(b);
  });

  it("顺序两次相同请求命中缓存（只请求一次），对应「只请求一次」", async () => {
    let count = 0;
    const fetchImpl = fakeFetch(() => {
      count += 1;
      return mockResponse([1, 2]);
    });
    registerProvider("once", { request: createRequest({ defaults: { fetchImpl } }) });

    const binding: DataBinding = { type: "http", url: "/x", shape: "select" };
    await getProvider("once").load(binding, ctx());
    await getProvider("once").load(binding, ctx());
    expect(count).toBe(1);
  });

  it("请求失败时错误不污染缓存，重试会再次发请求", async () => {
    let count = 0;
    let fail = true;
    const fetchImpl = fakeFetch(() => {
      if (fail) {
        fail = false;
        throw new Error("boom");
      }
      count += 1;
      return mockResponse([1]);
    });
    registerProvider("retry", { request: createRequest({ defaults: { fetchImpl } }) });

    const binding: DataBinding = { type: "http", url: "/x", shape: "select" };
    await expect(getProvider("retry").load(binding, ctx())).rejects.toThrow("boom");
    await getProvider("retry").load(binding, ctx());
    expect(count).toBe(1);
  });

  it("binding.cache 优先于 provider 级 cache（带 ttl 会过期）", async () => {
    let count = 0;
    const fetchImpl = fakeFetch(() => {
      count += 1;
      return mockResponse([1]);
    });
    registerProvider("ttl", {
      request: createRequest({ defaults: { fetchImpl } }),
      cache: { ttl: 100000 },
    });

    const binding: DataBinding = { type: "http", url: "/x", shape: "select", cache: { ttl: 1 } };
    await getProvider("ttl").load(binding, ctx());
    await new Promise((r) => setTimeout(r, 5));
    await getProvider("ttl").load(binding, ctx());
    expect(count).toBe(2);
  });
});

describe("registry：可替换默认请求 + 命名 provider", () => {
  it("setDefaultRequest 可替换默认实例", () => {
    const a = createRequest({ defaults: { fetchImpl: fakeFetch(() => mockResponse([])) } });
    const b = createRequest({ defaults: { fetchImpl: fakeFetch(() => mockResponse([])) } });
    setDefaultRequest(a);
    expect(getDefaultRequest()).toBe(a);
    setDefaultRequest(b);
    expect(getDefaultRequest()).toBe(b);
  });

  it("default provider 绑定当前默认请求实例", async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch((input) => {
      calls.push(input);
      return mockResponse([{ label: "z", value: "9" }]);
    });
    setDefaultRequest(createRequest({ defaults: { fetchImpl } }));
    const binding: DataBinding = { type: "http", url: "/default/x", shape: "select" };
    const out = await loadData(binding, ctx());
    expect(calls[0]).toContain("/default/x");
    expect(out).toEqual([{ label: "z", value: "9" }]);
  });

  it("registerProvider 可指定独立请求实例，与 default 隔离", async () => {
    const defaultCalls: string[] = [];
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch((i) => {
            defaultCalls.push(i);
            return mockResponse([]);
          }),
        },
      }),
    );
    const customCalls: string[] = [];
    registerProvider("custom", {
      request: createRequest({
        defaults: {
          fetchImpl: fakeFetch((i) => {
            customCalls.push(i);
            return mockResponse([1]);
          }),
        },
      }),
    });

    await getProvider("custom").load({ type: "http", url: "/c" }, ctx());
    expect(customCalls).toHaveLength(1);
    expect(defaultCalls).toHaveLength(0); // 未污染默认
    expect(getProviderConfig("custom").request).not.toBe(getDefaultRequest());
  });
});
