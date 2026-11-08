// @vitest-environment jsdom
/**
 * UiAdapter 两个协议字段在 React 引擎里的真实消费，与 Vue 侧同一组语义：
 * provider（外层上下文包装）与 propAliases（属性名映射）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { SchemaRenderer, nativeAdapter } from "@x-ac/design-react";
import type { ControlProps, ReactMaterial, UiAdapter } from "@x-ac/design-react";
import { MATERIALS } from "@x-ac/design-core";
import type { PageSchema } from "@x-ac/design-core";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 只关心驼峰属性，用来观察 Schema 里的通用名有没有被别名改写 */
function AliasInput(props: ControlProps) {
  return <input className="alias-input" data-maxlength={String(props.maxLength ?? "")} />;
}

/** 模拟 ant-design 的 ConfigProvider 这类外层上下文组件 */
function ThemeProvider({ children }: ControlProps) {
  return (
    <div className="theme-provider" data-theme="dark">
      {children}
    </div>
  );
}

function makePage(props: Record<string, unknown> = {}): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_react_adapter_contract",
    type: "page",
    meta: { title: "适配包契约", device: "pc" },
    state: {},
    children: [{ id: "n_input", component: "ec-input", props }],
  };
}

function makeAdapter(overrides: Partial<UiAdapter<ReactMaterial>> = {}): UiAdapter<ReactMaterial> {
  return {
    ...nativeAdapter,
    components: { ...nativeAdapter.components, "ec-input": AliasInput },
    materials: MATERIALS,
    ...overrides,
  };
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: ReactElement): void {
  act(() => root.render(element));
}

describe("UiAdapter.provider", () => {
  it("配置后由 provider 包住整棵渲染树", () => {
    render(<SchemaRenderer page={makePage()} ui={makeAdapter({ provider: ThemeProvider })} />);
    const provider = container.querySelector(".theme-provider");
    expect(provider).toBeTruthy();
    expect(provider?.getAttribute("data-theme")).toBe("dark");
    expect(provider?.querySelector(":scope > .ux-page")).toBeTruthy();
    expect(container.querySelector(".alias-input")).toBeTruthy();
  });

  it("未配置时不产生额外 DOM，根节点仍是 div.ux-page", () => {
    render(<SchemaRenderer page={makePage()} ui={makeAdapter()} />);
    expect(container.firstElementChild?.classList.contains("ux-page")).toBe(true);
    expect(container.querySelector(".theme-provider")).toBeNull();
  });
});

describe("UiAdapter.propAliases", () => {
  it("Schema 通用名按别名映射成 UI 库的真实属性名", () => {
    render(
      <SchemaRenderer
        page={makePage({ maxlength: 6 })}
        ui={makeAdapter({ propAliases: { maxlength: "maxLength" } })}
      />,
    );
    expect(container.querySelector(".alias-input")?.getAttribute("data-maxlength")).toBe("6");
  });

  it("未配置别名时原名透传，驼峰 prop 收不到值", () => {
    render(<SchemaRenderer page={makePage({ maxlength: 6 })} ui={makeAdapter()} />);
    const input = container.querySelector(".alias-input");
    expect(input?.getAttribute("data-maxlength")).toBe("");
    expect(input?.hasAttribute("maxLength")).toBe(false);
  });
});
