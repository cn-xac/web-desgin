import { MATERIALS, registerMaterials } from "@x-ac/web-design-core";
import { defineVueAdapter, VUE_BINDING } from "@x-ac/web-design-vue/kit";
import NativeHeading from "./NativeHeading.vue";
import NativeInput from "./NativeInput.vue";
import NativeButton from "./NativeButton.vue";

/**
 * ① 用 core 的 defineVueAdapter 收敛「组件表 + 绑定通道」。
 *    VUE_BINDING 即 Vue 默认通道 modelValue / update:modelValue，组件无需关心。
 *    组件实现用纯原生标签，所以这套适配包零 UI 库依赖。
 */
const nativeAdapter = defineVueAdapter({
  name: "vue-native",
  binding: VUE_BINDING,
  materials: MATERIALS,
  components: {
    "native-heading": NativeHeading,
    "native-input": NativeInput,
    "native-button": NativeButton,
  },
});

/**
 * ② 在适配包之上注册业务物料。
 *    impl     —— 组件实现（渲染器按 component 名查表）
 *    props    —— 默认值；其中 modelValue 写成 "{{scopeVar}}" 即与页面数据双向绑定
 *    fields   —— 设计器属性面板的编辑控件定义
 *    events   —— 该物料支持的事件（点击 → node-event 通知）
 */
export const demoAdapter = registerMaterials(nativeAdapter, [
  {
    component: "native-heading",
    title: "标题",
    category: "展示",
    kind: "display",
    icon: "H",
    impl: NativeHeading,
    props: { text: "原生组件示例", level: 2 },
    fields: [
      { key: "text", label: "文本", type: "text" },
      { key: "level", label: "级别", type: "select", options: [1, 2, 3] },
    ],
  },
  {
    component: "native-input",
    title: "文本输入",
    category: "表单",
    kind: "field",
    icon: "T",
    // 标记为表单控件：参与必填校验，且未写 modelValue 时按「前缀.组件ID」自动绑定
    isFormControl: true,
    impl: NativeInput,
    props: { modelValue: "", placeholder: "请输入" },
    fields: [{ key: "placeholder", label: "占位符", type: "text" }],
  },
  {
    component: "native-button",
    title: "按钮",
    category: "表单",
    kind: "action",
    icon: "B",
    impl: NativeButton,
    props: { label: "提交", type: "primary" },
    fields: [
      { key: "label", label: "文案", type: "text" },
      { key: "type", label: "类型", type: "select", options: ["default", "primary"] },
    ],
    events: [{ name: "click", title: "点击" }],
  },
]);
