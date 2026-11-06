/**
 * @x-ac/design-vue-element-plus —— Element Plus 适配包。
 *
 * 提供三样东西，缺一不可：
 * 1. components：协议物料名（ec-input）→ Element Plus 组件；
 * 2. binding：该库的双向绑定通道；其他库常见的是 value / onUpdate:value；
 * 3. actions：消息与确认框的副作用实现。
 *
 * 物料元数据暂时直接复用 core 的清单（P1 阶段保持单一事实来源），
 * P3 会在本包里补上 Element Plus 专有属性与 portability 标注。
 */
import type { Component } from "vue";
import { MATERIALS, type UiAdapter } from "@x-ac/design-core";
import { COMPONENT_MAP, resolveComponent } from "./components";
import { elementAdapter, runActions } from "./actions";

export const elementPlusAdapter: UiAdapter<Component | string> = {
  name: "element-plus",
  components: COMPONENT_MAP,
  materials: MATERIALS,
  binding: { prop: "modelValue", event: "onUpdate:modelValue" },
  actions: elementAdapter,
};

export { COMPONENT_MAP, resolveComponent };
export { elementAdapter, runActions };
