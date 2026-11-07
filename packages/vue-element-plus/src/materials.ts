/**
 * Element Plus 适配包的物料元数据。
 *
 * core 的 MATERIALS 是「各 UI 库都有的通用能力」；这里追加 Element Plus 专有属性，
 * 设计器属性面板会按当前适配包渲染，所以用了 EP 就只看到 EP 能设的属性。
 *
 * 只给直接映射 El* 原生组件的物料加字段：Field* / Block* 是自定义组件，
 * 它们的 props 由组件自己声明，追加字段会「设了没效果」。
 * 所有字段都显式标注 portability，专有属性基本是 visual（换库可丢）。
 */
import { bareKey, MATERIALS, type Material, type PropField } from "@x-ac/design-core";

const EP_FIELDS: Record<string, PropField[]> = {
  input: [
    { key: "showWordLimit", label: "字数统计", type: "boolean", portability: "behavior" },
    { key: "showPassword", label: "密码切换", type: "boolean", portability: "behavior" },
    { key: "prefixIcon", label: "前置图标", type: "text", portability: "visual" },
  ],
  textarea: [{ key: "showWordLimit", label: "字数统计", type: "boolean", portability: "behavior" }],
  number: [
    { key: "controls", label: "显示增减按钮", type: "boolean", portability: "visual" },
    { key: "controlsPosition", label: "按钮位置", type: "select", options: ["", "right"], portability: "visual" },
  ],
  date: [
    { key: "editable", label: "可手动输入", type: "boolean", portability: "behavior" },
    { key: "rangeSeparator", label: "区间分隔符", type: "text", portability: "content" },
  ],
  switch: [{ key: "inlinePrompt", label: "文内置入", type: "boolean", portability: "visual" }],
  rate: [{ key: "showScore", label: "显示分数", type: "boolean", portability: "visual" }],
  slider: [
    { key: "showTooltip", label: "显示提示", type: "boolean", portability: "visual" },
    { key: "range", label: "区间选择", type: "boolean", portability: "behavior" },
  ],
  button: [
    { key: "loading", label: "加载中", type: "boolean", portability: "behavior" },
    { key: "round", label: "圆角", type: "boolean", portability: "visual" },
    { key: "circle", label: "圆形", type: "boolean", portability: "visual" },
  ],
  link: [{ key: "icon", label: "图标", type: "text", portability: "visual" }],
  tag: [
    { key: "size", label: "尺寸", type: "select", options: ["large", "default", "small"], portability: "visual" },
    { key: "closable", label: "可关闭", type: "boolean", portability: "behavior" },
  ],
  alert: [
    { key: "effect", label: "风格", type: "select", options: ["light", "dark"], portability: "visual" },
    { key: "center", label: "文字居中", type: "boolean", portability: "visual" },
  ],
  image: [
    { key: "lazy", label: "懒加载", type: "boolean", portability: "behavior" },
    { key: "preview", label: "点击预览", type: "boolean", portability: "visual" },
  ],
  divider: [
    { key: "direction", label: "方向", type: "select", options: ["horizontal", "vertical"], portability: "visual" },
    { key: "borderStyle", label: "线型", type: "select", options: ["solid", "dashed", "dotted"], portability: "visual" },
  ],
  space: [{ key: "alignment", label: "对齐", type: "select", options: ["start", "center", "end"], portability: "visual" }],
};

/** 在通用清单上追加 EP 专有字段；不改结构字段，保证 store 的结构判断仍与 core 一致 */
export const elementPlusMaterials: Material[] = MATERIALS.map((material) => {
  const extra = EP_FIELDS[bareKey(material.component)];
  if (!extra?.length) return material;
  return { ...material, fields: [...material.fields, ...extra] };
});
