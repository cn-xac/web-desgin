// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createRef } from "react";
import type { RefObject } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaRenderer } from "@x-ac/design-react";
import type { SchemaRendererHandle } from "@x-ac/design-react";
import type { PageSchema } from "@x-ac/design-core";

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "react_validate",
  type: "page",
  meta: { title: "React 校验" },
  state: { form: { name: "" } },
  children: [
    {
      id: "rv_name",
      component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }, { type: "minLength", value: 2 }],
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

async function mountRenderer(): Promise<{ ref: RefObject<SchemaRendererHandle>; host: HTMLDivElement }> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ref = createRef<SchemaRendererHandle>();

  await act(async () => {
    root!.render(<SchemaRenderer ref={ref} page={page} />);
  });

  return { ref, host: container };
}

/** React 18 的 onChange 监听 input 事件，直接改 value 不会触发，需要走原生 setter */
function type(host: HTMLDivElement, value: string): void {
  const input = host.querySelector("input")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("React 渲染器：ref API", () => {
  it("validate() 报错并渲染到字段下方", async () => {
    const { ref, host } = await mountRenderer();

    let valid = true;
    await act(async () => {
      valid = ref.current!.validate();
    });

    expect(valid).toBe(false);
    expect(host.textContent).toContain("请填写姓名");
  });

  it("改动后重新校验通过，错误消失", async () => {
    const { ref, host } = await mountRenderer();

    await act(async () => {
      ref.current!.validate();
    });
    expect(host.textContent).toContain("请填写姓名");

    await act(async () => {
      type(host, "王小明");
    });

    let valid = false;
    await act(async () => {
      valid = ref.current!.validate();
    });

    expect(valid).toBe(true);
    expect(host.textContent).not.toContain("请填写姓名");
    expect(ref.current!.getErrors()).toEqual({});
  });

  it("getData() 与 Vue 版结构一致", async () => {
    const { ref, host } = await mountRenderer();

    await act(async () => {
      type(host, "王小明");
    });

    const result = ref.current!.getData();
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ form: { name: "王小明" } });
    expect(result.flat).toEqual({ "form.name": "王小明" });
  });

  it("reset() 恢复初值并清空错误", async () => {
    const { ref, host } = await mountRenderer();

    await act(async () => {
      type(host, "王小明");
      ref.current!.validate();
    });
    expect(host.textContent).not.toContain("请填写姓名");

    await act(async () => {
      ref.current!.reset();
    });

    expect(ref.current!.scope).toEqual({ form: { name: "" } });
    expect(ref.current!.getErrors()).toEqual({});
  });
});
