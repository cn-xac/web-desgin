// @vitest-environment jsdom
/**
 * 失焦校验对齐 Vue：校验走字段外壳的 focusout 冒泡，不依赖 UI 组件转发 onBlur。
 * 这里故意用一个「不接 onBlur」的组件，模拟第三方 UI 库常见的行为。
 */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaRenderer, createNativeAdapter, nativeAdapter } from "@x-ac/web-design-react";
import type { ControlProps } from "@x-ac/web-design-react";
import type { PageSchema } from "@x-ac/web-design-core";

/** 只接 value / onChange，明确不转发 onBlur（也不把它挂到 input 上） */
function OpaqueInput({ value, onChange }: ControlProps) {
  return (
    <input
      className="opaque-input"
      value={String(value ?? "")}
      onChange={(event) => (onChange as ((v: unknown) => void) | undefined)?.(event.target.value)}
    />
  );
}

const adapter = createNativeAdapter({
  components: {
    ...nativeAdapter.components,
    input: OpaqueInput as never,
    "ec-input": OpaqueInput as never,
  },
});

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "react_blur",
  type: "page",
  meta: { title: "失焦对齐" },
  state: { form: { name: "" } },
  children: [
    {
      id: "rb_name",
      component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }],
    },
  ],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(mode: "view" | "edit" = "view"): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<SchemaRenderer page={page} ui={adapter} mode={mode} />);
  });
  return container;
}

describe("React 失焦校验（对齐 Vue focusout）", () => {
  it("组件不转发 onBlur 时，focusout 冒泡仍能触发单字段校验", async () => {
    const host = await mount();
    const input = host.querySelector("input")!;
    expect(host.textContent).not.toContain("请填写姓名");

    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(host.textContent).toContain("请填写姓名");
    expect(host.querySelector(".ux-field")?.classList.contains("is-error")).toBe(true);
  });

  it("同一字段内部移动焦点不算失焦", async () => {
    const host = await mount();
    const input = host.querySelector("input")!;
    const wrapper = host.querySelector(".ux-field")!;
    const inner = document.createElement("button");
    wrapper.appendChild(inner);

    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: inner }));
    });

    expect(host.textContent).not.toContain("请填写姓名");
  });

  it("edit 模式不跑校验", async () => {
    const host = await mount("edit");
    await act(async () => {
      host.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(host.textContent).not.toContain("请填写姓名");
  });
});
