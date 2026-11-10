// @vitest-environment jsdom
/**
 * React 应用级适配包注入（对齐 Vue 的 createVueDesign + UI_ADAPTER）。
 *
 * 断言同一组语义：一处注入、整棵子树生效；局部 prop 可覆盖；
 * 没注入时回落内置原生物料；工厂形态与手写 Provider 等价。
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReactDesignProvider,
  SchemaRenderer,
  createReactDesign,
  nativeAdapter,
  registerMaterials,
  useUiAdapter,
} from "@x-ac/web-design-react";
import type { ControlProps, ReactMaterial, UiAdapter } from "@x-ac/web-design-react";
import type { PageSchema } from "@x-ac/web-design-core";

function ExtensionBadge({ text, style }: ControlProps) {
  return (
    <span className="ext-badge" style={style}>
      {String(text ?? "")}
    </span>
  );
}

/** 模拟扩展仓产物：在内置适配包上追加一个业务物料 */
const extensionAdapter: UiAdapter<ReactMaterial> = registerMaterials<ReactMaterial>(
  { ...nativeAdapter, name: "react-extension" },
  [
    {
      component: "biz-provider-badge",
      title: "扩展徽章",
      impl: ExtensionBadge,
      props: { text: "来自扩展仓" },
    },
  ],
);

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "react_provider",
  type: "page",
  meta: { title: "应用级注入" },
  state: {},
  children: [{ id: "rp_badge", component: "biz-provider-badge", props: {} }],
};

describe("ReactDesignProvider 应用级注入", () => {
  it("useUiAdapter 在 Provider 外返回 null，在内部拿到同一份 adapter 引用", () => {
    let seen: UiAdapter<ReactMaterial> | null | undefined;

    function Probe() {
      seen = useUiAdapter();
      return null;
    }

    renderToStaticMarkup(<Probe />);
    expect(seen).toBeNull();

    renderToStaticMarkup(
      <ReactDesignProvider adapter={extensionAdapter}>
        <Probe />
      </ReactDesignProvider>,
    );
    expect(seen).toBe(extensionAdapter);
  });

  it("子树里所有 SchemaRenderer 都吃到注入的适配包，不必逐个传 ui", () => {
    const html = renderToStaticMarkup(
      <ReactDesignProvider adapter={extensionAdapter}>
        <>
          <SchemaRenderer page={page} />
          <SchemaRenderer page={page} />
        </>
      </ReactDesignProvider>,
    );

    expect(html.match(/ext-badge/g)).toHaveLength(2);
    expect(html).toContain("来自扩展仓");
    expect(html).not.toContain("未知组件");
  });

  it("SchemaRenderer 的 ui prop 优先于 Provider（局部覆盖仍可用）", () => {
    const html = renderToStaticMarkup(
      <ReactDesignProvider adapter={extensionAdapter}>
        <SchemaRenderer page={page} ui={nativeAdapter} />
      </ReactDesignProvider>,
    );

    expect(html).toContain("未知组件 biz-provider-badge");
    expect(html).not.toContain("ext-badge");
  });

  it("没有 Provider、也没有 ui prop 时回落 nativeAdapter，旧用法不受影响", () => {
    const plain = renderToStaticMarkup(<SchemaRenderer page={page} />);
    expect(plain).toContain("未知组件 biz-provider-badge");

    const explicit = renderToStaticMarkup(<SchemaRenderer page={page} ui={extensionAdapter} />);
    expect(explicit).toContain("ext-badge");
  });

  it("嵌套 Provider 取最近一层（与 React Context 语义一致）", () => {
    const html = renderToStaticMarkup(
      <ReactDesignProvider adapter={extensionAdapter}>
        <ReactDesignProvider adapter={nativeAdapter}>
          <SchemaRenderer page={page} />
        </ReactDesignProvider>
      </ReactDesignProvider>,
    );

    expect(html).toContain("未知组件 biz-provider-badge");
  });

  it("createReactDesign 工厂返回的 Provider 与手写 Provider 等价", () => {
    const DesignProvider = createReactDesign(extensionAdapter);
    const html = renderToStaticMarkup(
      <DesignProvider>
        <SchemaRenderer page={page} />
      </DesignProvider>,
    );

    expect(html).toContain("ext-badge");
    expect(html).toContain("来自扩展仓");
  });
});
