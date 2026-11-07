import { nativeAdapter, registerMaterials } from "@x-ac/design-react";
import type { ReactMaterial, UiAdapter } from "@x-ac/design-react";
import { PriorityTag } from "./materials/PriorityTag";

/**
 * 示例宿主的适配包：内置原生实现 + 一个业务物料。
 *
 * 真实项目里这段就是「把公司内部组件接进低代码平台」的全部工作——
 * 一份声明写清组件、默认属性、属性面板的编辑方式，引擎侧零改动。
 */
export const demoAdapter: UiAdapter<ReactMaterial> = registerMaterials<ReactMaterial>(nativeAdapter, [
  {
    component: "biz-priority",
    title: "优先级标签",
    kind: "display",
    category: "业务",
    impl: PriorityTag,
    props: { level: "高" },
    defaultStyle: { display: "block", marginBottom: "12px" },
    fields: [
      { key: "level", label: "等级", type: "select", options: ["高", "中", "低"] },
    ],
  },
]);
