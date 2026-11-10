// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import {
  formatSpacing,
  normalizeLength,
  parseSpacing,
  readSpacing,
  resolveNodeStyle,
  spacingToCss,
  writeSpacing,
} from "@x-ac/web-design-core";
import { SchemaRenderer } from "@x-ac/web-design-vue";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
});

describe("间距工具（框架无关）", () => {
  it("数字与纯数字字符串补 px，其余原样", () => {
    expect(normalizeLength(8)).toBe("8px");
    expect(normalizeLength("12")).toBe("12px");
    expect(normalizeLength("1.5rem")).toBe("1.5rem");
    expect(normalizeLength("auto")).toBe("auto");
    expect(normalizeLength("")).toBe("");
    expect(normalizeLength(undefined)).toBe("");
  });

  it("CSS 简写按 1/2/3/4 值规则解析", () => {
    expect(parseSpacing("8px")).toEqual({ top: "8px", right: "8px", bottom: "8px", left: "8px" });
    expect(parseSpacing("8px 12px")).toEqual({ top: "8px", right: "12px", bottom: "8px", left: "12px" });
    expect(parseSpacing("8 12 4")).toEqual({ top: "8px", right: "12px", bottom: "4px", left: "12px" });
    expect(parseSpacing("8 12 4 6")).toEqual({ top: "8px", right: "12px", bottom: "4px", left: "6px" });
    expect(parseSpacing("")).toEqual({ top: "", right: "", bottom: "", left: "" });
  });

  it("四边收敛回最简简写", () => {
    expect(formatSpacing({ top: "8px", right: "8px", bottom: "8px", left: "8px" })).toBe("8px");
    expect(formatSpacing({ top: "8px", right: "12px", bottom: "8px", left: "12px" })).toBe("8px 12px");
    expect(formatSpacing({ top: "0px", right: "0px", bottom: "12px", left: "0px" })).toBe("0px 0px 12px");
  });
});

describe("间距写回 Schema", () => {
  it("四边相等 → 简写，便于导出与阅读", () => {
    const style: Record<string, unknown> = {};
    writeSpacing(style, "padding", { top: "16px", right: "16px", bottom: "16px", left: "16px" });
    expect(style).toEqual({ padding: "16px" });
  });

  it("四边不等 → 长写，且不残留非法简写", () => {
    const style: Record<string, unknown> = { margin: "8px" };
    writeSpacing(style, "margin", { top: "8", right: "0", bottom: "12px", left: "0" });
    // 显式写 0 与「留空」语义不同：留空表示回落简写，写 0 就是真的 0
    expect(style).toEqual({
      marginTop: "8px",
      marginRight: "0",
      marginBottom: "12px",
      marginLeft: "0",
    });
    expect(style).not.toHaveProperty("margin");
  });

  it("清空四边 → 键被移除而不是留空字符串", () => {
    const style: Record<string, unknown> = { margin: "8px", marginTop: "4px" };
    writeSpacing(style, "margin", { top: "", right: "", bottom: "", left: "" });
    expect(style).toEqual({});
  });

  it("读回时长写优先，缺失的边回落到简写", () => {
    const read = readSpacing({ margin: "8px 12px", marginBottom: "2px" }, "margin");
    expect(read.mode).toBe("longhand");
    expect(read.box).toEqual({ top: "8px", right: "12px", bottom: "2px", left: "12px" });

    expect(readSpacing({}, "padding")).toMatchObject({ mode: "unset" });
    expect(readSpacing({ padding: "4px" }, "padding").mode).toBe("shorthand");
  });

  it("导出 CSS 文本时保持间距语义", () => {
    expect(spacingToCss({ margin: "0 0 12px", paddingTop: "6px", paddingBottom: "6px" })).toEqual({
      margin: "0 0 12px",
      paddingTop: "6px",
      paddingBottom: "6px",
    });
  });
});

describe("渲染时应用通用间距", () => {
  it("物料默认间距生效，节点 style 可覆盖", () => {
    const base = resolveNodeStyle("text", { text: "hi" }, undefined);
    expect(base.margin).toBe("0 0 10px");

    const overridden = resolveNodeStyle("text", { text: "hi" }, { margin: "0" });
    expect(overridden.margin).toBe("0");
  });

  it.skipIf(!__HAS_ELEMENT_PLUS__)("margin / padding 落到真实 DOM", () => {
    const wrapper = mount(SchemaRenderer, {
      props: {
        page: {
          schemaVersion: "1.0.0",
          id: "p1",
          type: "page",
          state: {},
          children: [
            {
              id: "n1",
              component: "text",
              props: { text: "带间距的文本" },
              style: { margin: "8px 12px", padding: "4px" },
            },
          ],
        },
      },
      global: { plugins: [ElementPlus] },
    });

    const element = wrapper.find("p").element as HTMLElement;
    expect(element.style.margin).toBe("8px 12px");
    expect(element.style.padding).toBe("4px");
  });

  it.skipIf(!__HAS_ELEMENT_PLUS__)("表单控件的内边距作用在字段外壳上，不挤压输入框内部", () => {
    const wrapper = mount(SchemaRenderer, {
      props: {
        page: {
          schemaVersion: "1.0.0",
          id: "p2",
          type: "page",
          state: {},
          children: [
            {
              id: "n2",
              component: "input",
              props: { label: "姓名", modelValue: "{{form.name}}" },
              style: { padding: "10px", marginBottom: "16px" },
            },
          ],
        },
      },
      global: { plugins: [ElementPlus] },
    });

    const shell = wrapper.find(".wb-field").element as HTMLElement;
    expect(shell.style.padding).toBe("10px");
    expect(shell.style.marginBottom).toBe("16px");

    const input = wrapper.find("input").element as HTMLElement;
    expect(input.style.padding).toBe("");
  });
});
