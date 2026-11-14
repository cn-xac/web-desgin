import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collectExternalSources,
  createRequest,
  defaultScopePath,
  isOnceOnly,
  loadExternalSource,
  loadExternalSources,
  reachesTriggerLength,
  resolveExternalParams,
  responsesOf,
  setDefaultRequest,
  toDataBinding,
  type ExternalDataSource,
  type PageSchema,
} from "@x-ac/web-design-core";

/**
 * 外部数据源（rg4KCt）。
 *
 * 三条主线：
 * - 配置翻译：参数映射 → {{}} 绑定；只请求一次 → 页面级缓存；
 * - 运行时：结果写进 scope 的 response.scopePath，元素再通过 {{}} 读它；
 * - 触发：输入长度达到阈值才发请求，且同一个值不重复触发。
 */

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

function page(children: PageSchema["children"] = []): PageSchema {
  return { schemaVersion: "1.0.0", id: "p1", type: "page", children };
}

const source = (partial: Partial<ExternalDataSource> = {}): ExternalDataSource => ({
  id: "s_auto",
  url: "/api/dept",
  ...partial,
});

beforeEach(() => {
  setDefaultRequest(
    createRequest({ defaults: { fetchImpl: fakeFetch(() => mockResponse([])) } }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toDataBinding：配置翻译", () => {
  it("参数映射翻成 {{}} 绑定", () => {
    const binding = toDataBinding(
      source({
        method: "POST",
        params: [{ key: "keyword", path: "form.keyword" }],
      }),
    );
    expect(binding.method).toBe("POST");
    expect(binding.params).toEqual({ keyword: "{{form.keyword}}" });
  });

  it("缺省只请求一次（页面级缓存，不过期）", () => {
    expect(isOnceOnly(source())).toBe(true);
    expect(toDataBinding(source()).cache).toEqual({});
    expect(toDataBinding(source({ once: false })).cache).toEqual({ ttl: 0 });
  });

  it("绑定取原始响应，形态映射下放到各响应（#4）", () => {
    const binding = toDataBinding(
      source({
        responses: [
          { scopePath: "external.dept", shape: "select", labelField: "name", valueField: "id", listField: "data.list" },
        ],
      }),
    );
    // toDataBinding 只负责原始响应 + 参数绑定；形态按响应分别归一化
    expect(binding.shape).toBe("form");
    expect(binding.params).toEqual({});
  });

  it("responsesOf 兼容旧的单条 response 写法", () => {
    const legacy = source({ response: { scopePath: "external.dept", shape: "select" } });
    expect(responsesOf(legacy)).toEqual([{ scopePath: "external.dept", shape: "select" }]);
    expect(responsesOf(source({ responses: [{ scopePath: "external.x" }] }))).toEqual([
      { scopePath: "external.x" },
    ]);
  });
});

describe("loadExternalSource：运行时取数", () => {
  it("结果写进 scope 的响应路径", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse({ id: 1, name: "技术中心" })),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    const result = await loadExternalSource(
      source({ responses: [{ scopePath: "external.dept" }] }),
      scope,
    );
    expect(result).toEqual({ id: 1, name: "技术中心" });
    expect((scope.external as Record<string, unknown>).dept).toEqual({ id: 1, name: "技术中心" });
  });

  it("多条响应各自写入不同 scope 路径（#4）", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() =>
            mockResponse({ data: { list: [{ id: 1, name: "A" }] }, summary: "共 1 条" }),
          ),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [
          { scopePath: "external.options", shape: "select", listField: "data.list", labelField: "name", valueField: "id" },
          { scopePath: "external.info", shape: "form" },
        ],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).options).toEqual([{ label: "A", value: "1" }]);
    expect((scope.external as Record<string, unknown>).info).toEqual({
      data: { list: [{ id: 1, name: "A" }] },
      summary: "共 1 条",
    });
  });

  it("选项形态按 label/value 映射后写入", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() =>
            mockResponse({ data: { list: [{ id: 1, name: "A" }, { id: 2, name: "B" }] } }),
          ),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [
          {
            scopePath: "external.dept",
            shape: "select",
            listField: "data.list",
            labelField: "name",
            valueField: "id",
          },
        ],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).dept).toEqual([
      { label: "A", value: "1" },
      { label: "B", value: "2" },
    ]);
  });

  it("选项数据源未配 value 映射时 value 默认等于 label（#5）", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse([{ name: "技术中心" }, { name: "产品中心" }])),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        asOptions: true,
        responses: [{ scopePath: "external.dept", shape: "select", labelField: "name" }],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).dept).toEqual([
      { label: "技术中心", value: "技术中心" },
      { label: "产品中心", value: "产品中心" },
    ]);
  });

  it("请求参数取自页面元素当前值", async () => {
    let seen = "";
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch((input) => {
            seen = input;
            return mockResponse([]);
          }),
        },
      }),
    );
    const scope: Record<string, unknown> = { form: { keyword: "架构" } };
    await loadExternalSource(
      source({ params: [{ key: "keyword", path: "form.keyword" }] }),
      scope,
    );
    expect(seen).toContain("keyword");
    expect(seen).toContain("%E6%9E%B6%E6%9E%84");
  });

  it("取数失败不抛错，保留原值", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => {
            throw new Error("boom");
          }),
        },
      }),
    );
    const scope: Record<string, unknown> = { external: { dept: "旧值" } };
    const errors: string[] = [];
    const result = await loadExternalSource(
      source({ responses: [{ scopePath: "external.dept" }] }),
      scope,
      { onError: (message) => errors.push(message) },
    );
    expect(result).toBeUndefined();
    expect((scope.external as Record<string, unknown>).dept).toBe("旧值");
    expect(errors[0]).toContain("加载失败");
  });
});

describe("collectExternalSources / loadExternalSources：页面级遍历", () => {
  it("收集页面里所有带外部数据源的节点", () => {
    const list = collectExternalSources(
      {
        ...page([
          { id: "a", component: "ec-select", props: {}, externalRef: "e1" },
          { id: "b", component: "ec-input", props: {} },
          {
            id: "c",
            component: "ec-container",
            props: {},
            children: [{ id: "d", component: "ec-input", props: {}, externalRef: "e2" }],
          },
        ]),
        externalSources: {
          e1: { ...source(), id: "e1" },
          e2: { ...source({ url: "/x" }), id: "e2" },
        },
      },
    );
    expect(list.map((item) => item.node?.id)).toEqual(["a", "d"]);
  });

  it("加载时跳过触发型数据源（等输入够长度再触发）", async () => {
    let calls = 0;
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => {
            calls += 1;
            return mockResponse([]);
          }),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSources(
      {
        ...page([{ id: "a", component: "ec-input", props: {}, externalRef: "e1" }]),
        externalSources: { e1: { ...source({ triggerLength: 2 }), id: "e1" } },
      },
      scope,
    );
    expect(calls).toBe(0);
  });
});

describe("触发长度", () => {
  it("达到阈值才算触发", () => {
    expect(reachesTriggerLength(source({ triggerLength: 3 }), "ab")).toBe(false);
    expect(reachesTriggerLength(source({ triggerLength: 3 }), "abc")).toBe(true);
    expect(reachesTriggerLength(source({ triggerLength: 3 }), "abcd")).toBe(true);
  });

  it("未设阈值表示加载即取，不靠输入触发", () => {
    expect(reachesTriggerLength(source(), "anything")).toBe(false);
  });
});

describe("辅助函数", () => {
  it("默认响应路径形如 external.<名称>", () => {
    expect(defaultScopePath("部门")).toBe("external.部门");
    expect(defaultScopePath("dept list")).toBe("external.deptlist");
    expect(defaultScopePath()).toBe("external.data");
  });

  it("参数求值走 scope", () => {
    const out = resolveExternalParams(
      source({ params: [{ key: "keyword", path: "form.keyword" }] }),
      { form: { keyword: "abc" } },
    );
    expect(out).toEqual({ keyword: "abc" });
  });
});

describe("显示内容模板（#3）", () => {
  it("下拉：逐项渲染模板作为展示文本，值仍按 valueField 映射", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() =>
            mockResponse({ list: [{ id: 1, name: "张三", code: "ZS001" }] }),
          ),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [
          {
            scopePath: "external.dept",
            shape: "select",
            listField: "list",
            labelField: "name",
            valueField: "id",
            display: "{{data.name}}/{{data.code}}",
          },
        ],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).dept).toEqual([
      { label: "张三/ZS001", value: "1" },
    ]);
  });

  it("输入框：把整段响应渲染成字符串写入目标路径", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse({ a: "x", b: "y" })),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [{ scopePath: "external.info", shape: "form", display: "{{data.a}}/{{data.b}}" }],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).info).toBe("x/y");
  });

  it("模板既能读响应数据，也能读页面 scope", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse({ a: "x" })),
        },
      }),
    );
    const scope: Record<string, unknown> = { form: { code: "C1" } };
    await loadExternalSource(
      source({
        responses: [{ scopePath: "external.info", shape: "form", display: "{{form.code}}-{{data.a}}" }],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).info).toBe("C1-x");
  });

  it("响应字段可平铺取用：{{a}} 等价于 {{data.a}}", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse({ a: "x" })),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [{ scopePath: "external.info", shape: "form", display: "[{{a}}]" }],
      }),
      scope,
    );
    expect((scope.external as Record<string, unknown>).info).toBe("[x]");
  });
});

describe("子映射（#4）", () => {
  it("响应数组的每一行按子映射填成明细对象", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() =>
            mockResponse({ rows: [{ goodsName: "A", qty: 2 }, { goodsName: "B", qty: 5 }] }),
          ),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [
          {
            scopePath: "form.items",
            shape: "form",
            listField: "rows",
            parentField: "items",
            subMaps: [
              { field: "goods", from: "goodsName" },
              { field: "qty", from: "qty" },
            ],
          },
        ],
      }),
      scope,
    );
    expect(scope.form).toEqual({
      items: [
        { goods: "A", qty: 2 },
        { goods: "B", qty: 5 },
      ],
    });
  });

  it("子映射支持嵌套字段名", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse([{ price: { qty: 3 } }])),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({
        responses: [
          {
            scopePath: "form.items",
            shape: "form",
            parentField: "items",
            subMaps: [{ field: "detail.qty", from: "price.qty" }],
          },
        ],
      }),
      scope,
    );
    expect(scope.form).toEqual({ items: [{ detail: { qty: 3 } }] });
  });

  it("未配子映射时整个响应数组原样写入", async () => {
    setDefaultRequest(
      createRequest({
        defaults: {
          fetchImpl: fakeFetch(() => mockResponse([{ goodsName: "A" }])),
        },
      }),
    );
    const scope: Record<string, unknown> = {};
    await loadExternalSource(
      source({ responses: [{ scopePath: "form.items", shape: "form", parentField: "items" }] }),
      scope,
    );
    expect(scope.form).toEqual({ items: [{ goodsName: "A" }] });
  });
});
