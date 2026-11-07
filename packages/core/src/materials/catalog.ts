import type { Material, Portability, PropField, PropFieldGroup } from "./types";
import { materialKey } from "./keys";
import { tagPortability } from "./portability";
import { mergeFields } from "./fields";
import { createRegistry, type MaterialRegistry } from "./registry";

/**
 * 物料清单。默认值只在这里定义一次：节点 props 里只存与默认值不同的键，
 * 渲染时以 { ...defaultProps, ...props } 合并，导出即为最小化 JSON。
 *
 * 表里写裸名（`input`），对外统一加 `ec-` 前缀（`ec-input`）：归一化只发生在下面的 MATERIALS。
 */

const commonEvents = {
  inputEvents: [
    { name: "change", title: "值改变" },
    { name: "blur", title: "失焦" },
  ],
  clickEvents: [{ name: "click", title: "点击" }],
};

const MATERIALS_RAW: Material[] = [
  /* ---------------- 布局 ---------------- */
  {
    component: "container",
    title: "容器",
    category: "布局",
    kind: "layout",
    icon: "▢",
    acceptsChildren: true,
    defaultProps: { padding: 0 },
    fields: [
      { key: "padding", label: "内边距(px)", type: "number" },
      { key: "background", label: "背景色", type: "color" },
      { key: "borderRadius", label: "圆角(px)", type: "number" },
    ],
    hint: "最通用的布局容器，可嵌套任意组件",
  },
  {
    component: "grid",
    title: "栅格",
    category: "布局",
    kind: "layout",
    icon: "▦",
    acceptsChildren: true,
    defaultProps: { columns: 2, gap: 16, columnGap: 0 },
    fields: [
      { key: "columns", label: "列数", type: "number" },
      { key: "gap", label: "行间距(px)", type: "number" },
      { key: "columnGap", label: "列间距(px)", type: "number" },
    ],
    hint: "等宽栅格，列间距留空时与行间距一致",
  },
  {
    component: "card",
    title: "卡片",
    category: "布局",
    kind: "layout",
    icon: "▤",
    acceptsChildren: true,
    defaultProps: { title: "卡片标题", shadow: "never" },
    fields: [
      { key: "title", label: "标题", type: "text" },
      {
        key: "shadow",
        label: "阴影",
        type: "select",
        options: ["never", "hover", "always"],
      },
    ],
    hint: "带标题的内容分组",
  },
  {
    component: "space",
    title: "间距组",
    category: "布局",
    kind: "layout",
    icon: "⇹",
    acceptsChildren: true,
    defaultProps: { direction: "horizontal", size: 12, wrap: true },
    fields: [
      {
        key: "direction",
        label: "方向",
        type: "select",
        options: ["horizontal", "vertical"],
      },
      { key: "size", label: "间距(px)", type: "number" },
      { key: "wrap", label: "自动换行", type: "boolean" },
    ],
    hint: "按钮组、标签组等横向排列场景",
  },

  /* ---------------- 展示 ---------------- */
  {
    component: "title",
    title: "标题",
    category: "展示",
    kind: "display",
    icon: "H",
    textProp: "text",
    defaultProps: { text: "区域标题", level: 3, align: "left" },
    fields: [
      { key: "text", label: "文本", type: "text" },
      { key: "level", label: "层级", type: "select", options: [2, 3, 4, 5] },
      {
        key: "align",
        label: "对齐",
        type: "select",
        options: ["left", "center", "right"],
      },
    ],
  },
  {
    component: "text",
    title: "文本",
    category: "展示",
    kind: "display",
    icon: "T",
    textProp: "text",
    internalProps: ["size", "muted"],
    defaultStyle: { margin: "0 0 10px" },
    defaultProps: { text: "这是一段说明文本，可在右侧修改内容，也可以绑定 {{form.name}} 这样的变量。" },
    fields: [
      { key: "text", label: "文本", type: "textarea", tip: "支持 {{path}} 插值" },
      {
        key: "size",
        label: "字号",
        type: "select",
        options: ["small", "default", "large"],
      },
      { key: "muted", label: "次要样式", type: "boolean" },
    ],
  },
  {
    component: "divider",
    title: "分割线",
    category: "展示",
    kind: "display",
    icon: "—",
    defaultProps: { contentPosition: "center" },
    fields: [
      {
        key: "contentPosition",
        label: "文案位置",
        type: "select",
        options: ["left", "center", "right"],
      },
    ],
  },
  {
    component: "tag",
    title: "标签",
    category: "展示",
    kind: "display",
    icon: "◈",
    textProp: "text",
    defaultProps: { text: "标签", type: "primary", effect: "light" },
    fields: [
      { key: "text", label: "文本", type: "text" },
      {
        key: "type",
        label: "类型",
        type: "select",
        options: ["primary", "success", "warning", "info", "danger"],
      },
      { key: "effect", label: "风格", type: "select", options: ["light", "dark", "plain"] },
    ],
  },
  {
    component: "alert",
    title: "提示条",
    category: "展示",
    kind: "display",
    icon: "!",
    defaultProps: {
      title: "提示信息",
      type: "info",
      description: "",
      closable: false,
      showIcon: true,
    },
    fields: [
      { key: "title", label: "标题", type: "text" },
      { key: "description", label: "描述", type: "textarea" },
      {
        key: "type",
        label: "类型",
        type: "select",
        options: ["info", "success", "warning", "error"],
      },
      { key: "closable", label: "可关闭", type: "boolean" },
    ],
  },
  {
    component: "image",
    title: "图片",
    category: "展示",
    kind: "display",
    icon: "▧",
    defaultProps: { src: "", width: 240, fit: "cover", radius: 6 },
    fields: [
      { key: "src", label: "图片地址", type: "text" },
      { key: "width", label: "宽度(px)", type: "number" },
      { key: "fit", label: "填充", type: "select", options: ["cover", "contain", "fill"] },
      { key: "radius", label: "圆角(px)", type: "number" },
    ],
  },
  {
    component: "table",
    title: "表格",
    category: "展示",
    kind: "display",
    icon: "▥",
    defaultProps: {
      columns: [
        { label: "姓名", prop: "name" },
        { label: "部门", prop: "dept" },
        { label: "状态", prop: "status" },
      ],
      data: "{{list}}",
      border: true,
      stripe: false,
      emptyText: "暂无数据",
      rowKey: "",
    },
    fields: [
      { key: "columns", label: "列定义", type: "columns" },
      { key: "data", label: "数据源", type: "text", tip: "绑定表达式，如 {{list}}" },
      { key: "emptyText", label: "空状态文案", type: "text" },
      { key: "border", label: "显示边框", type: "boolean" },
      { key: "stripe", label: "斑马纹", type: "boolean" },
    ],
    events: [{ name: "row-click", title: "行点击" }],
    hint: "列定义支持「标签:字段名」成对配置，数据源支持绑定页面状态",
  },

  /* ---------------- 表单 ---------------- */
  {
    component: "input",
    title: "输入框",
    category: "表单",
    kind: "field",
    icon: "▭",
    defaultProps: { label: "字段名", placeholder: "请输入", required: false, clearable: true, disabled: false },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "placeholder", label: "占位提示", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.name}}" },
      { key: "clearable", label: "可清空", type: "boolean" },
      { key: "disabled", label: "禁用", type: "boolean" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "textarea",
    title: "多行文本",
    category: "表单",
    kind: "field",
    icon: "▤",
    defaultProps: { label: "备注", placeholder: "请输入内容", required: false, rows: 3, type: "textarea", resize: "vertical" },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "placeholder", label: "占位提示", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.remark}}" },
      { key: "rows", label: "行数", type: "number" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "number",
    title: "数字输入",
    category: "表单",
    kind: "field",
    icon: "#",
    defaultProps: { label: "数量", placeholder: "请输入数字", required: false, min: 0, precision: 0 },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.count}}" },
      { key: "min", label: "最小值", type: "number" },
      { key: "max", label: "最大值", type: "number" },
      { key: "precision", label: "小数位", type: "number" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "select",
    title: "下拉选择",
    category: "表单",
    kind: "field",
    icon: "▾",
    defaultProps: {
      label: "类型",
      placeholder: "请选择",
      options: "技术中心,产品中心,设计中心",
      required: false,
      clearable: true,
    },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "options", label: "选项", type: "options", tip: "逗号分隔，如 技术中心,产品中心" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.dept}}" },
      { key: "placeholder", label: "占位提示", type: "text" },
      { key: "clearable", label: "可清空", type: "boolean" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "radio",
    title: "单选框",
    category: "表单",
    kind: "field",
    icon: "◉",
    defaultProps: { label: "选项", options: "选项一,选项二", required: false },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "options", label: "选项", type: "options" },
      { key: "modelValue", label: "数据绑定", type: "text" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "checkbox",
    title: "多选框",
    category: "表单",
    kind: "field",
    icon: "☑",
    defaultProps: { label: "选项", options: "选项一,选项二,选项三", required: false },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "options", label: "选项", type: "options" },
      { key: "modelValue", label: "数据绑定", type: "text" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "switch",
    title: "开关",
    category: "表单",
    kind: "field",
    icon: "◐",
    defaultProps: { label: "开关", activeText: "开", inactiveText: "关" },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text" },
      { key: "activeText", label: "打开文案", type: "text" },
      { key: "inactiveText", label: "关闭文案", type: "text" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "date",
    title: "日期选择",
    category: "表单",
    kind: "field",
    icon: "▦",
    defaultProps: {
      label: "日期",
      placeholder: "选择日期",
      required: false,
      type: "date",
      valueFormat: "YYYY-MM-DD",
    },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text" },
      {
        key: "type",
        label: "类型",
        type: "select",
        options: ["date", "daterange", "month", "datetime"],
      },
      { key: "valueFormat", label: "值格式", type: "text" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "rate",
    title: "评分",
    category: "表单",
    kind: "field",
    icon: "★",
    defaultProps: { label: "评分", max: 5, allowHalf: false },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text" },
      { key: "max", label: "最高分", type: "number" },
      { key: "allowHalf", label: "允许半星", type: "boolean" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },
  {
    component: "slider",
    title: "滑块",
    category: "表单",
    kind: "field",
    icon: "⇹",
    defaultProps: { label: "滑块", min: 0, max: 100, step: 1 },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text" },
      { key: "min", label: "最小值", type: "number" },
      { key: "max", label: "最大值", type: "number" },
      { key: "step", label: "步长", type: "number" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
  },

  /* ---------------- 交互 ---------------- */
  {
    component: "button",
    title: "按钮",
    category: "交互",
    kind: "action",
    icon: "◉",
    textProp: "text",
    defaultProps: { text: "提交", type: "primary", plain: false, size: "default", block: false },
    fields: [
      { key: "text", label: "文案", type: "text" },
      {
        key: "type",
        label: "样式",
        type: "select",
        options: ["primary", "success", "warning", "danger", "info", "default"],
      },
      { key: "plain", label: "朴素按钮", type: "boolean" },
      { key: "size", label: "尺寸", type: "select", options: ["large", "default", "small"] },
      { key: "block", label: "占满宽度", type: "boolean" },
      { key: "disabled", label: "禁用", type: "boolean" },
    ],
    events: commonEvents.clickEvents,
  },
  {
    component: "link",
    title: "文字链接",
    category: "交互",
    kind: "action",
    icon: "↗",
    textProp: "text",
    defaultProps: { text: "查看详情", type: "primary", underline: false },
    fields: [
      { key: "text", label: "文案", type: "text" },
      { key: "type", label: "类型", type: "select", options: ["primary", "success", "warning", "danger", "info"] },
      { key: "underline", label: "下划线", type: "boolean" },
    ],
    events: commonEvents.clickEvents,
  },

  /* ---------------- 业务 ---------------- */
  {
    component: "org-picker",
    title: "组织选择",
    category: "业务",
    kind: "field",
    icon: "⌂",
    defaultProps: { label: "所属组织", placeholder: "请选择组织", required: false, checkStrictly: true },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.org}}" },
      { key: "placeholder", label: "占位提示", type: "text" },
      { key: "checkStrictly", label: "允许选父级", type: "boolean" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
    hint: "演示业务组件接入方式：内置组织树，真实项目替换为接口取数",
  },
  {
    component: "dict-select",
    title: "字典下拉",
    category: "业务",
    kind: "field",
    icon: "≡",
    defaultProps: { label: "字典项", dict: "priority", required: false, placeholder: "请选择" },
    fields: [
      { key: "label", label: "标签", type: "text" },
      {
        key: "dict",
        label: "字典编码",
        type: "select",
        options: ["priority", "status", "channel"],
        tip: "priority 优先级 / status 状态 / channel 渠道",
      },
      { key: "modelValue", label: "数据绑定", type: "text" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
    hint: "演示字典类组件：按编码取枚举，不在 Schema 里硬编码选项",
  },
  {
    component: "amount-input",
    title: "金额输入",
    category: "业务",
    kind: "field",
    icon: "¥",
    defaultProps: { label: "金额", placeholder: "请输入金额", required: false, precision: 2, min: 0 },
    fields: [
      { key: "label", label: "标签", type: "text" },
      { key: "modelValue", label: "数据绑定", type: "text", tip: "如 {{form.amount}}" },
      { key: "precision", label: "小数位", type: "number" },
      { key: "min", label: "最小值", type: "number" },
      { key: "max", label: "最大值", type: "number" },
    ],
    events: commonEvents.inputEvents,
    isFormControl: true,
    hint: "演示金额类组件：千分位展示 + 精度控制",
  },
];

/**
 * 通用字段扩展：各 UI 库都有的能力，放在协议层；
 * 库专有字段（effect / showWordLimit / loading 等）由适配包的 materials 追加。
 * 这里用裸名作 key（与 MATERIALS_RAW 一致），归一化在构建时统一完成。
 */
const COMMON_FIELDS: Record<string, PropField[]> = {
  input: [
    { key: "maxlength", label: "最大长度", type: "number", portability: "behavior" },
    { key: "size", label: "尺寸", type: "select", options: ["large", "default", "small"], portability: "visual" },
  ],
  textarea: [
    { key: "maxlength", label: "最大长度", type: "number", portability: "behavior" },
    { key: "disabled", label: "禁用", type: "boolean", portability: "behavior" },
    { key: "resize", label: "缩放方向", type: "select", options: ["vertical", "none", "both", "horizontal"], portability: "visual" },
  ],
  number: [
    { key: "step", label: "步长", type: "number", portability: "behavior" },
    { key: "disabled", label: "禁用", type: "boolean", portability: "behavior" },
  ],
  select: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  radio: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  checkbox: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  switch: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  date: [
    { key: "format", label: "显示格式", type: "text", portability: "behavior" },
    { key: "clearable", label: "可清空", type: "boolean", portability: "behavior" },
    { key: "disabled", label: "禁用", type: "boolean", portability: "behavior" },
  ],
  rate: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  slider: [{ key: "disabled", label: "禁用", type: "boolean", portability: "behavior" }],
  link: [
    { key: "href", label: "链接地址", type: "text", portability: "content" },
    { key: "disabled", label: "禁用", type: "boolean", portability: "behavior" },
  ],
  image: [{ key: "alt", label: "替代文本", type: "text", portability: "content" }],
  table: [
    { key: "rowKey", label: "行唯一键", type: "text", portability: "behavior" },
    { key: "size", label: "尺寸", type: "select", options: ["large", "default", "small"], portability: "visual" },
  ],
  alert: [{ key: "showIcon", label: "显示图标", type: "boolean", portability: "visual" }],
};

/**
 * 同名不同义的字段必须按物料显式覆盖，不能只靠键名推断：
 * `type` 在日期里决定数据格式（behavior），在按钮/标签/提示条里只是配色（visual）。
 */
const PORTABILITY_OVERRIDES: Record<string, Record<string, Portability>> = {
  date: { type: "behavior" },
  button: { type: "visual" },
  tag: { type: "visual" },
  alert: { type: "visual" },
  link: { type: "visual" },
};

/**
 * 字段分组（未列出的走 basic）。集中在这里而不是逐条写进 fields：
 * 分组是「属性面板怎么摆」，不是「组件是什么」，混进物料定义会淹没真正的信息。
 */
const FIELD_GROUP_OVERRIDES: Record<string, Record<string, PropFieldGroup>> = {
  container: { padding: "style", background: "style", borderRadius: "style" },
  grid: { columns: "style", gap: "style", columnGap: "style" },
  card: { title: "content", shadow: "style" },
  space: { direction: "style", size: "style", wrap: "style" },
  title: { text: "content", level: "style", align: "style" },
  text: { text: "content", size: "style", muted: "style" },
  divider: { contentPosition: "style", direction: "style", borderStyle: "style" },
  tag: { text: "content", type: "style", effect: "style" },
  alert: {
    title: "content",
    description: "content",
    type: "style",
    showIcon: "style",
    effect: "style",
    center: "style",
  },
  image: { src: "content", alt: "content", width: "style", fit: "style", radius: "style", lazy: "advanced", preview: "advanced" },
  table: { columns: "content", data: "data", emptyText: "content", border: "style", stripe: "style", size: "style", rowKey: "advanced" },
  input: { modelValue: "data", maxlength: "advanced", size: "style" },
  textarea: { modelValue: "data", rows: "basic", resize: "style" },
  number: { modelValue: "data", precision: "advanced" },
  select: { options: "content", modelValue: "data" },
  radio: { options: "content", modelValue: "data" },
  checkbox: { options: "content", modelValue: "data" },
  switch: { modelValue: "data", activeText: "content", inactiveText: "content" },
  date: { modelValue: "data", valueFormat: "data", format: "data" },
  rate: { modelValue: "data", allowHalf: "advanced" },
  slider: { modelValue: "data" },
  button: { text: "content", type: "style", plain: "style", size: "style", block: "style" },
  link: { text: "content", href: "content", type: "style", underline: "style" },
  "org-picker": { modelValue: "data", checkStrictly: "advanced" },
  "dict-select": { modelValue: "data" },
  "amount-input": { modelValue: "data", precision: "advanced" },
};

/**
 * 对外物料清单：组件名统一加 `ec-` 前缀，补齐通用字段与 owner / portable 默认值，
 * 并把每个字段的 portability 固化成显式值。
 * 历史 Schema 里的裸名（`input`）仍可解析 —— 归一化在 registry 查询时完成。
 */
export const MATERIALS: Material[] = MATERIALS_RAW.map((raw) => {
  const overrides = PORTABILITY_OVERRIDES[raw.component] ?? {};
  const groups = FIELD_GROUP_OVERRIDES[raw.component] ?? {};
  // 通用字段用 mergeFields 合并：同名键就地覆盖，不产生两个写同一 prop 的输入框
  const fields = mergeFields(
    raw.fields.map((field) =>
      overrides[field.key] ? { ...field, portability: overrides[field.key] } : field,
    ),
    COMMON_FIELDS[raw.component] ?? [],
  ).map((field) => (groups[field.key] ? { ...field, group: groups[field.key] } : field));

  return tagPortability({
    ...raw,
    component: materialKey(raw.component),
    fields,
    owner: raw.owner ?? "adapter",
    portable: raw.portable ?? true,
  });
});

export const registry: MaterialRegistry = createRegistry(MATERIALS);

export function getMaterial(component: string): Material | undefined {
  return registry.get(component);
}

export function acceptsChildren(component: string): boolean {
  return Boolean(getMaterial(component)?.acceptsChildren);
}

/** 已注册的组件名（协议名，含 ec- 前缀） */
export const KNOWN_COMPONENTS = new Set(registry.keys());

export const materialsByCategory = registry.byCategory;

/** 节点有效属性 = 物料默认值 + 节点自身属性（默认值不落库的实现基石） */
export function resolveDefaults(component: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
  const material = registry.get(component);
  return { ...(material?.defaultProps ?? {}), ...(props ?? {}) };
}

/**
 * 物料默认样式：节点 style 里没写的键才回落，写了（哪怕写成 0）就以节点为准。
 *
 * `material` 用于注入式目录：渲染器持有的是当前适配包的物料表（含业务物料），
 * 不传则退回全局 registry，保持历史调用兼容。
 */
export function resolveDefaultStyle(
  component: string,
  style: Record<string, unknown> | undefined,
  material: Material | undefined = registry.get(component),
): Record<string, string> {
  const defaults = material?.defaultStyle ?? {};
  const merged: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    merged[key] = String(value);
  }
  return merged;
}
