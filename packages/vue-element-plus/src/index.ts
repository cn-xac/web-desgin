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
import { ElColorPicker, ElInput, ElInputNumber, ElMessage, ElSwitch } from "element-plus";
import { type DesignerKit, type UiAdapter } from "@x-ac/design-core";
import { COMPONENT_MAP, resolveComponent } from "./components";
import { elementPlusMaterials } from "./materials";
import { elementAdapter, runActions } from "./actions";
import EpButton from "./designer/EpButton.vue";
import EpSegmented from "./designer/EpSegmented.vue";
import EpSelect from "./designer/EpSelect.vue";

/**
 * 设计器自身 UI 的 Element Plus 实现（D3）：
 * 宿主用什么库，设计器的按钮、输入框、下拉就是什么库的，避免「设计时与上线两张皮」。
 * 未列出的槽位由引擎回落原生实现。
 */
const designerKit: DesignerKit<Component> = {
  Button: EpButton,
  Input: ElInput as unknown as Component,
  NumberInput: ElInputNumber as unknown as Component,
  Select: EpSelect,
  Switch: ElSwitch as unknown as Component,
  Segmented: EpSegmented,
  ColorInput: ElColorPicker as unknown as Component,
  notify: (message, type = "info") => {
    ElMessage({ message, type });
  },
};

export const elementPlusAdapter: UiAdapter<Component | string> = {
  name: "element-plus",
  components: COMPONENT_MAP,
  materials: elementPlusMaterials,
  designer: designerKit as unknown as DesignerKit<Component | string>,
  binding: { prop: "modelValue", event: "onUpdate:modelValue" },
  actions: elementAdapter,
};

export { COMPONENT_MAP, resolveComponent };
export { elementAdapter, runActions };
export { designerKit };
export { elementPlusMaterials };
