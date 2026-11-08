// @vitest-environment jsdom
/**
 * React 设计器：与 Vue SchemaDesigner 的能力对齐测试。
 *
 * 覆盖四栏布局、物料点击添加、画布节点选中/拖拽外壳、撤销重做、
 * ref 命令式 API（导入/导出/保存），以及 UiAdapter.designer / editors 槽位消费。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createRef } from "react";
import type { ComponentType, ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaDesigner } from "@x-ac/design-react/designer";
import type { SchemaDesignerHandle } from "@x-ac/design-react/designer";
import { ReactDesignProvider, nativeAdapter } from "@x-ac/design-react";
import type { ReactMaterial } from "@x-ac/design-react";
import { createEmptyPage, createMemoryRepository } from "@x-ac/design-core";
import type { PageRepository, PageSchema, UiAdapter } from "@x-ac/design-core";

/* jsdom 没有 Blob URL 与下载导航，导出链路需要打桩 */
beforeEach(() => {
  if (typeof URL.createObjectURL !== "function") {
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => undefined;
  }
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  // 轻提示 1.8s 后才移除，用例之间先清干净，避免断言取到上一条 toast
  document.querySelectorAll(".wbd-toast").forEach((element) => element.remove());
});
afterEach(() => {
  vi.restoreAllMocks();
});

function seedPage(): PageSchema {
  return { ...createEmptyPage("测试页"), id: "p1", children: [] };
}

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const repo: PageRepository = createMemoryRepository([seedPage()]);
  const render = async (element: ReactElement) => {
    await act(async () => {
      root.render(element);
    });
  };
  const cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, repo, render, cleanup };
}

function byText(container: HTMLElement, selector: string, text: string): HTMLElement | undefined {
  return [...container.querySelectorAll<HTMLElement>(selector)].find((element) =>
    (element.textContent ?? "").includes(text),
  );
}

describe("React SchemaDesigner 基础能力", () => {
  it("四栏齐备、顶栏动作齐全、初始节点数为 0", async () => {
    const { container, repo, render, cleanup } = setup();
    try {
      await render(<SchemaDesigner pageId="p1" repository={repo} />);
      expect(container.querySelector(".designer")).toBeTruthy();
      expect(container.querySelector(".topbar")).toBeTruthy();
      expect(container.querySelector(".palette")).toBeTruthy();
      expect(container.querySelector(".opanel")).toBeTruthy();
      expect(container.querySelector(".stage")).toBeTruthy();
      expect(container.querySelector(".inspector")).toBeTruthy();
      expect(container.querySelector(".stat")?.textContent).toContain("0 个节点");
      for (const label of ["导入", "导出 JSON", "导出 HTML", "预览", "保存"]) {
        expect(byText(container, ".wbd-btn", label)).toBeTruthy();
      }
    } finally {
      await cleanup();
    }
  });

  it("点击物料添加节点，画布带 data-node-id，组件树同步", async () => {
    const { container, repo, render, cleanup } = setup();
    try {
      await render(<SchemaDesigner pageId="p1" repository={repo} />);
      const item = byText(container, ".palette__item", "按钮");
      expect(item).toBeTruthy();
      await act(async () => item!.click());

      expect(container.querySelector(".stat")?.textContent).toContain("1 个节点");
      const node = container.querySelector<HTMLElement>("[data-node-id]");
      expect(node).toBeTruthy();
      expect(node?.getAttribute("data-node-label")).toBe("按钮");
      expect(container.querySelector(".canvas__badge")?.textContent).toContain("PC");
      expect(container.querySelectorAll(".otree__row").length).toBe(1);
    } finally {
      await cleanup();
    }
  });

  it("画布节点点击选中 / Esc 取消，撤销重做按钮联动", async () => {
    const { container, repo, render, cleanup } = setup();
    try {
      await render(<SchemaDesigner pageId="p1" repository={repo} />);
      const item = byText(container, ".palette__item", "按钮");
      await act(async () => item!.click());

      const node = container.querySelector<HTMLElement>("[data-node-id]")!;
      await act(async () => node.click());
      expect(container.querySelector("[data-node-id]")?.classList.contains("is-selected")).toBe(true);
      expect(byText(container, ".inspector__tab", "属性")).toBeTruthy();

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(container.querySelector("[data-node-id]")?.classList.contains("is-selected")).toBe(false);

      const undo = [...container.querySelectorAll<HTMLButtonElement>(".icon-btn")].find((button) =>
        (button.title ?? "").includes("撤销"),
      )!;
      await act(async () => undo.click());
      expect(container.querySelector(".stat")?.textContent).toContain("0 个节点");

      const redo = [...container.querySelectorAll<HTMLButtonElement>(".icon-btn")].find((button) =>
        (button.title ?? "").includes("重做"),
      )!;
      await act(async () => redo.click());
      expect(container.querySelector(".stat")?.textContent).toContain("1 个节点");
    } finally {
      await cleanup();
    }
  });
});

describe("React SchemaDesigner 命令式 API", () => {
  it("ref 暴露 importSchema / exportSchema / exportHtml / save，走同一份 core 仓储", async () => {
    const { container, repo, render, cleanup } = setup();
    const ref = createRef<SchemaDesignerHandle>();
    try {
      await render(<SchemaDesigner pageId="p1" repository={repo} ref={ref} />);
      expect(ref.current).toBeTruthy();

      const imported: PageSchema = {
        ...seedPage(),
        children: [{ id: "n1", component: "button", props: { text: "导入按钮" } }],
      };
      let ok = false;
      await act(async () => {
        ok = ref.current!.importSchema(JSON.stringify(imported));
      });
      expect(ok).toBe(true);
      expect(container.querySelector(".stat")?.textContent).toContain("1 个节点");

      const json = ref.current!.exportSchema();
      expect(JSON.parse(json).children).toHaveLength(1);
      const html = ref.current!.exportHtml();
      expect(html).toContain("<html");

      let saved = false;
      await act(async () => {
        saved = ref.current!.save();
      });
      expect(saved).toBe(true);
      expect(repo.get("p1")?.schema.children).toHaveLength(1);
      expect(container.querySelector(".dirty")).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("非法 Schema 导入被拒绝并给出提示，不污染当前页面", async () => {
    const { container, repo, render, cleanup } = setup();
    const ref = createRef<SchemaDesignerHandle>();
    try {
      await render(<SchemaDesigner pageId="p1" repository={repo} ref={ref} />);
      let ok = true;
      await act(async () => {
        ok = ref.current!.importSchema('{"oops":true}');
      });
      expect(ok).toBe(false);
      expect(container.querySelector(".stat")?.textContent).toContain("0 个节点");
      expect(document.querySelector(".wbd-toast")?.textContent).toContain("导入失败");
    } finally {
      await cleanup();
    }
  });
});

describe("React SchemaDesigner 适配包槽位", () => {
  it("UiAdapter.designer.Button 覆盖设计时按钮", async () => {
    const { container, repo, render, cleanup } = setup();
    const CustomButton = (({ children }: { children?: unknown }) => (
      <button data-custom-button>{children as never}</button>
    )) as unknown as ComponentType<never>;
    const adapter: UiAdapter<ReactMaterial> = {
      ...nativeAdapter,
      designer: { Button: CustomButton as never },
    };
    try {
      await render(
        <ReactDesignProvider adapter={adapter}>
          <SchemaDesigner pageId="p1" repository={repo} />
        </ReactDesignProvider>,
      );
      expect(container.querySelectorAll("[data-custom-button]").length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  it("UiAdapter.editors.text 覆盖属性面板的字段编辑器", async () => {
    const { container, repo, render, cleanup } = setup();
    const CustomEditor = (({ field }: { field?: { key?: string } }) => (
      <input data-custom-editor data-key={field?.key} />
    )) as unknown as ComponentType<never>;
    const adapter: UiAdapter<ReactMaterial> = {
      ...nativeAdapter,
      editors: { text: CustomEditor as never },
    };
    try {
      await render(
        <ReactDesignProvider adapter={adapter}>
          <SchemaDesigner pageId="p1" repository={repo} />
        </ReactDesignProvider>,
      );
      const item = byText(container, ".palette__item", "按钮");
      await act(async () => item!.click());
      expect(container.querySelectorAll("[data-custom-editor]").length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });
});
