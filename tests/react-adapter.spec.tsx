// @vitest-environment jsdom
/**
 * React 引擎的适配包链路（T-033）。
 *
 * 与 Vue 侧 elementPlusAdapter 是同一份契约，所以断言也按同一组语义写：
 *   - 内置 adapter 自己就是契约的合法实现；
 *   - registerMaterials 之后业务物料能渲染、能校验、能吃到默认样式；
 *   - 换绑定通道时 Schema 不用改。
 */
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createRef } from "react";
import type { RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MATERIALS,
  REACT_BINDING,
  SchemaRenderer,
  nativeAdapter,
  registerMaterials,
} from "@x-ac/design-react";
import type { ControlProps, ReactMaterial, SchemaRendererHandle, UiAdapter } from "@x-ac/design-react";
import { missingComponents } from "@x-ac/design-core";
import type { PageSchema } from "@x-ac/design-core";

/* ---------------- 自研 React 组件：只用 ControlProps，不依赖任何 UI 库 ---------------- */

/** 约定：style 必须落在根元素上，否则通用间距与物料默认样式会失效 */
function BizBadge({ text, level, style }: ControlProps) {
  const tone = level === "高" ? "danger" : "normal";
  return (
    <span className={`biz-badge biz-badge--${tone}`} style={style}>
      {String(text ?? "")}
    </span>
  );
}

/** React 标准通道：value + onChange（与 nativeAdapter.binding 一致） */
function BizRate({ value, onChange, style }: ControlProps) {
  return (
    <input
      className="biz-rate"
      style={style}
      value={String(value ?? "")}
      onChange={(event) => (onChange as ((v: unknown) => void) | undefined)?.(event.target.value)}
    />
  );
}

/** 自定义通道版本：读 model、抛 onModelChange，用来验证 binding 真的被消费 */
function BizModelRate({ model, onModelChange, style }: ControlProps) {
  return (
    <input
      className="biz-rate"
      style={style}
      value={String(model ?? "")}
      onChange={(event) => (onModelChange as ((v: unknown) => void) | undefined)?.(event.target.value)}
    />
  );
}

/** 带自定义绑定通道的适配包：Schema 依旧写 modelValue，由 binding 翻译成 model */
const modelAdapter: UiAdapter<ReactMaterial> = registerMaterials<ReactMaterial>(
  { ...nativeAdapter, binding: { prop: "model", event: "onModelChange" } },
  [{ component: "biz-rate", title: "满意度", impl: BizModelRate, props: { model: "" } }],
);

const badgeAdapter: UiAdapter<ReactMaterial> = registerMaterials<ReactMaterial>(nativeAdapter, [
  {
    component: "biz-risk-badge",
    title: "风险徽章",
    impl: BizBadge,
    props: { text: "风险待评估", level: "中" },
    defaultStyle: { letterSpacing: "1px" },
    fields: [
      { key: "text", label: "文案", type: "text" },
      { key: "level", label: "等级", type: "select", options: ["高", "中", "低"] },
    ],
  },
]);

describe("内置适配包是契约的合法实现", () => {
  it("元数据自洽：物料、组件、绑定通道、动作副作用齐全", () => {
    expect(nativeAdapter.name).toBe("react-native");
    expect(nativeAdapter.binding).toEqual(REACT_BINDING);
    expect(nativeAdapter.binding).toEqual({ prop: "value", event: "onChange" });
    // materials 就是 core 的清单本身，不复制一份，避免两边漂移
    expect(nativeAdapter.materials).toBe(MATERIALS);
    expect(typeof nativeAdapter.actions?.notify).toBe("function");
    expect(typeof nativeAdapter.actions?.confirm).toBe("function");
  });

  it("内置组件表覆盖全部通用物料，启动自检无缺失", () => {
    expect(missingComponents(nativeAdapter)).toEqual([]);
  });

  it("registerMaterials 不改动入参，返回新 adapter", () => {
    expect(badgeAdapter).not.toBe(nativeAdapter);
    expect(nativeAdapter.materials).toBe(MATERIALS);
    expect(nativeAdapter.components["ec-biz-risk-badge"]).toBeUndefined();
    expect(badgeAdapter.components["ec-biz-risk-badge"]).toBe(BizBadge);
  });
});

describe("业务物料在 React 侧可渲染", () => {
  const page: PageSchema = {
    schemaVersion: "1.0.0",
    id: "react_badge",
    type: "page",
    meta: { title: "业务物料" },
    state: {},
    children: [
      { id: "rb_badge", component: "biz-risk-badge", props: { level: "高" } },
      { id: "rb_text", component: "text", props: { text: "普通物料照常渲染" } },
      { id: "rb_unknown", component: "biz-not-registered", props: {} },
    ],
  };

  const html = renderToStaticMarkup(<SchemaRenderer page={page} ui={badgeAdapter} />);
  const plain = renderToStaticMarkup(<SchemaRenderer page={page} />);

  it("按 impl 渲染，不是未知占位", () => {
    expect(html).toContain("biz-badge--danger");
    // props 缺省值来自物料 defaultProps，节点只写了 level
    expect(html).toContain("风险待评估");
    expect(html).not.toContain("未知组件 biz-risk-badge");
  });

  it("物料 defaultStyle 生效（core 的 defaultStyle 走注入目录）", () => {
    expect(html).toContain("letter-spacing:1px");
  });

  it("换成没注册该物料的 adapter 就退回占位，不白屏", () => {
    expect(plain).toContain("未知组件 biz-risk-badge");
    expect(plain).toContain("普通物料照常渲染");
  });

  it("真正未注册的物料始终是占位", () => {
    expect(html).toContain("未知组件 biz-not-registered");
  });
});

describe("绑定通道可替换", () => {
  const page: PageSchema = {
    schemaVersion: "1.0.0",
    id: "react_binding",
    type: "page",
    meta: { title: "通道" },
    state: { form: { rate: "满意" } },
    children: [
      {
        id: "rb_rate",
        component: "biz-rate",
        props: { label: "满意度", modelValue: "{{form.rate}}" },
      },
    ],
  };

  it("Schema 里仍写 modelValue，渲染时换成适配包的 prop 名", () => {
    const html = renderToStaticMarkup(<SchemaRenderer page={page} ui={modelAdapter} />);
    expect(html).toContain("biz-rate");
    expect(html).toContain('value="满意"');
  });
});

/* ---------------- 命令式 API：需要真实挂载 ---------------- */

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(
  page: PageSchema,
  ui: UiAdapter<ReactMaterial>,
): Promise<{ ref: RefObject<SchemaRendererHandle>; host: HTMLDivElement }> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ref = createRef<SchemaRendererHandle>();

  await act(async () => {
    root!.render(<SchemaRenderer ref={ref} page={page} ui={ui} />);
  });

  return { ref, host: container };
}

describe("业务物料参与校验与取值", () => {
  const fieldAdapter: UiAdapter<ReactMaterial> = registerMaterials<ReactMaterial>(nativeAdapter, [
    {
      component: "biz-rate",
      title: "满意度",
      kind: "field",
      impl: BizRate,
      isFormControl: true,
      props: { value: "", label: "满意度" },
      fields: [{ key: "label", label: "标签", type: "text" }],
    },
  ]);

  const page: PageSchema = {
    schemaVersion: "1.0.0",
    id: "react_field",
    type: "page",
    meta: { title: "业务字段" },
    state: { form: { rate: "" } },
    children: [
      {
        id: "rb_rate",
        component: "biz-rate",
        props: { label: "满意度", modelValue: "{{form.rate}}" },
        rules: [{ type: "required" }],
      },
    ],
  };

  it("isFormControl 的业务物料按注入目录识别，required 规则生效", async () => {
    const { ref, host } = await mount(page, fieldAdapter);

    let valid = true;
    await act(async () => {
      valid = ref.current!.validate();
    });

    expect(valid).toBe(false);
    expect(host.textContent).toContain("请填写满意度");
  });

  it("getData 能把业务物料的绑定路径导出成嵌套数据", async () => {
    const { ref, host } = await mount(page, fieldAdapter);
    const input = host.querySelector(".biz-rate") as HTMLInputElement | null;

    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "满意");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const result = ref.current!.getData();
    expect(result.data).toEqual({ form: { rate: "满意" } });
    expect(result.valid).toBe(true);
  });
});
