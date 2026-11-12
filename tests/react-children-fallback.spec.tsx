import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SchemaRenderer } from "@x-ac/web-design-react";
import type { PageSchema } from "@x-ac/web-design-core";

// 畸形 Schema：完全缺失 children 字段
function missingChildrenPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "react-missing-children",
    type: "page",
    meta: { title: "畸形 Schema" },
    state: {},
  } as PageSchema;
}

// children 显式赋值为 undefined
function undefinedChildrenPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "react-undefined-children",
    type: "page",
    meta: { title: "undefined children" },
    state: {},
    children: undefined as unknown as never[],
  };
}

describe("React SchemaRenderer 对缺 children 的畸形 Schema 兜底", () => {
  it("缺 children 字段时不崩溃，渲染根容器", () => {
    let html = "";
    expect(() => {
      html = renderToStaticMarkup(<SchemaRenderer page={missingChildrenPage()} />);
    }).not.toThrow();
    // 兜底后至少渲染出根容器，而不是白屏 / 抛错
    expect(html).toContain("ux-page");
  });

  it("children 为 undefined 时不崩溃", () => {
    expect(() => {
      renderToStaticMarkup(<SchemaRenderer page={undefinedChildrenPage()} />);
    }).not.toThrow();
  });
});
