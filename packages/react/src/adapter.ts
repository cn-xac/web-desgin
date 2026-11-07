/**
 * React 侧的内置适配包（ADR-14）。
 *
 * 与 Vue 版 elementPlusAdapter 是同一份契约：组件表 + 物料元数据 + 双向绑定通道 + 动作副作用。
 * 区别只在缺省实现：这里不依赖任何 UI 库，全部是原生元素，
 * 宿主可以直接 `registerMaterials()` 追加业务物料，或自己拼一个 UiAdapter 整表替换。
 *
 * ```tsx
 * const adapter = registerMaterials(nativeAdapter, [
 *   { component: "biz-risk-badge", title: "风险徽章", impl: RiskBadge,
 *     fields: [{ key: "text", label: "文案", type: "text" }] },
 * ]);
 * <SchemaRenderer page={page} ui={adapter} />
 * ```
 */
import type { ComponentType } from "react";
import type { UiAdapter } from "@x-ac/design-core";
import { MATERIALS } from "@x-ac/design-core";
import { defaultAdapter } from "./actions";
import { COMPONENTS, type ControlProps } from "./components";

/** React 引擎认的组件实现：React 组件，或原生标签名（"div" / "span"） */
export type ReactMaterial = ComponentType<ControlProps> | string;

/**
 * React 的受控组件通道：`value` + `onChange`。
 * 与 Vue 的 `modelValue` + `onUpdate:modelValue` 是同一件事的不同拼写，
 * 所以 Schema 里始终写通用的 `modelValue: "{{form.name}}"`，由适配包翻译成本库的写法。
 */
export const REACT_BINDING = { prop: "value", event: "onChange" } as const;

/** 内置适配包：原生元素实现 + core 通用物料元数据 */
export const nativeAdapter: UiAdapter<ReactMaterial> = {
  name: "react-native",
  components: COMPONENTS,
  materials: MATERIALS,
  binding: REACT_BINDING,
  actions: defaultAdapter,
};

/**
 * 只给原生标签做映射的最小适配包：物料元数据仍然来自 core，
 * 适合「页面结构简单、不想引 UI 库」的宿主。
 */
export function createNativeAdapter(
  overrides: Partial<UiAdapter<ReactMaterial>> = {},
): UiAdapter<ReactMaterial> {
  return { ...nativeAdapter, ...overrides };
}
