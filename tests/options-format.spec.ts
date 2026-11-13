import { describe, it, expect } from "vitest";
import { formatOptionLines, parseOptionLines, parseOptions, toOptionLines } from "@x-ac/web-design-core";

/**
 * 选项录入格式（rSulo9）。
 *
 * 新格式：一行一个选项，名称在前、值在后，以空格（支持多个空格）隔开。
 * 旧格式（单行逗号分隔）必须继续能解析 —— 历史 Schema 里全是这种写法。
 */

describe("parseOptions：多行「名称 值」格式", () => {
  it("一行一个选项，名称在前值在后", () => {
    expect(parseOptions("技术中心 tech\n产品中心 product")).toEqual([
      { label: "技术中心", value: "tech" },
      { label: "产品中心", value: "product" },
    ]);
  });

  it("多个空格也算分隔", () => {
    expect(parseOptions("技术中心    tech")).toEqual([{ label: "技术中心", value: "tech" }]);
  });

  it("只写名称时值与名称相同", () => {
    expect(parseOptions("技术中心")).toEqual([{ label: "技术中心", value: "技术中心" }]);
  });

  it("值里可以含空格", () => {
    expect(parseOptionLines("技术中心 tech center")).toEqual([
      { label: "技术中心", value: "tech center" },
    ]);
  });

  it("空行被忽略", () => {
    expect(parseOptions("A a\n\n\nB b")).toHaveLength(2);
  });
});

describe("parseOptions：兼容历史写法", () => {
  it("旧的逗号分隔仍能解析，名称与值相同", () => {
    expect(parseOptions("技术中心,产品中心")).toEqual([
      { label: "技术中心", value: "技术中心" },
      { label: "产品中心", value: "产品中心" },
    ]);
  });

  it("已知取舍：条目内的空格按「名称 值」拆（历史 Schema 里没有这种写法）", () => {
    expect(parseOptions("Hello World")).toEqual([{ label: "Hello", value: "World" }]);
  });

  it("数组写法照旧", () => {
    expect(parseOptions([{ label: "A", value: "a" }])).toEqual([{ label: "A", value: "a" }]);
    expect(parseOptions(["A"])).toEqual([{ label: "A", value: "A" }]);
  });

  it("空值返回空数组", () => {
    expect(parseOptions("")).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
  });
});

describe("序列化往返", () => {
  it("formatOptionLines 与 parseOptionLines 互为逆运算", () => {
    const items = [
      { label: "技术中心", value: "tech" },
      { label: "产品中心", value: "product" },
    ];
    expect(parseOptionLines(formatOptionLines(items))).toEqual(items);
  });

  it("名称与值相同时只写名称", () => {
    expect(formatOptionLines([{ label: "A", value: "A" }])).toBe("A");
  });

  it("toOptionLines 把旧的逗号格式升级成多行", () => {
    expect(toOptionLines("技术中心,产品中心")).toBe("技术中心\n产品中心");
  });

  it("toOptionLines 对已经合规的多行保持原样", () => {
    expect(toOptionLines("技术中心 tech\n产品中心 product")).toBe("技术中心 tech\n产品中心 product");
  });
});
