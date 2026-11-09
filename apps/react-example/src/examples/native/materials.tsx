import { registerMaterials } from "@x-ac/design-core";
import { nativeAdapter } from "@x-ac/design-react";
import { NativeHeading } from "./NativeHeading";
import { NativeInput } from "./NativeInput";
import { NativeButton } from "./NativeButton";

// 在 React 内置 nativeAdapter（零 UI 库依赖）之上追加 3 个原生组件。
// impl 为 React 组件；props.modelValue: "{{name}}" 经 REACT_BINDING（value/onChange）与页面数据同步。
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
    impl: NativeInput,
    // isFormControl 让引擎识别为表单控件：未写 modelValue 时按 form.<id> 自动绑定，
    // 并参与必填校验与提交收集；对现有显式 modelValue 绑定 demo 无副作用。
    isFormControl: true,
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
