/**
 * 业务物料注册（T-032 示例）。
 *
 * 宿主接入自定义组件的全部成本就是这一份声明：组件实现 + 元数据 + 属性编辑方式。
 * 引擎、适配包、设计器都不用改；设计器面板里会多出「业务 · 风险徽章（自）」。
 *
 * 约定：
 * - component 自带业务前缀（biz-），不占用协议命名空间 ec-；
 * - fields[].type 决定属性面板的编辑控件（text / number / boolean / select / color / ...）；
 * - portable 保持默认 false —— 跨库可移植性由注册者负责，不参与跨库一致性测试。
 */
import { registerMaterials } from "@x-ac/design-core";
import { elementPlusAdapter } from "@x-ac/design-vue-element-plus";
import RiskBadge from "./RiskBadge.vue";

export const playgroundAdapter = registerMaterials(elementPlusAdapter, [
  {
    component: "biz-risk-badge",
    title: "风险徽章",
    category: "业务",
    kind: "display",
    icon: "⚠",
    impl: RiskBadge,
    props: { text: "风险待评估", level: "中", color: "", round: true },
    fields: [
      { key: "text", label: "文案", type: "text", portability: "content" },
      { key: "level", label: "等级", type: "select", options: ["高", "中", "低"], portability: "content" },
      { key: "color", label: "自定义颜色", type: "color", tip: "留空则按等级取色" },
      { key: "round", label: "圆角", type: "boolean" },
    ],
    events: [{ name: "click", title: "点击" }],
    hint: "业务物料示例：完全自研组件，一份声明接入设计器与渲染器",
  },
]);
