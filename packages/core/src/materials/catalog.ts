import type { Material, MaterialCategory } from "./types";

/**
 * 物料清单。默认值只在这里定义一次：节点 props 里只存与默认值不同的键，
 * 渲染时以 { ...defaultProps, ...props } 合并，导出即为最小化 JSON。
 */

const commonEvents = {
  inputEvents: [
    { name: "change", title: "值改变" },
    { name: "blur", title: "失焦" },
  ],
  clickEvents: [{ name: "click", title: "点击" }],
};

export const MATERIALS: Material[] = [
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

export const CATEGORIES: MaterialCategory[] = ["布局", "展示", "表单", "交互", "业务"];

const byComponent = new Map(MATERIALS.map((m) => [m.component, m]));

export function getMaterial(component: string): Material | undefined {
  return byComponent.get(component);
}

export function acceptsChildren(component: string): boolean {
  return Boolean(getMaterial(component)?.acceptsChildren);
}

export const KNOWN_COMPONENTS = new Set(MATERIALS.map((m) => m.component));

export function materialsByCategory(): Array<{ category: MaterialCategory; items: Material[] }> {
  return CATEGORIES.map((category) => ({
    category,
    items: MATERIALS.filter((m) => m.category === category),
  }));
}

/** 节点有效属性 = 物料默认值 + 节点自身属性（默认值不落库的实现基石） */
export function resolveDefaults(component: string, props: Record<string, unknown> | undefined): Record<string, unknown> {
  const material = byComponent.get(component);
  return { ...(material?.defaultProps ?? {}), ...(props ?? {}) };
}

/** 物料默认样式：节点 style 里没写的键才回落，写了（哪怕写成 0）就以节点为准 */
export function resolveDefaultStyle(
  component: string,
  style: Record<string, unknown> | undefined,
): Record<string, string> {
  const defaults = byComponent.get(component)?.defaultStyle ?? {};
  const merged: Record<string, string> = { ...defaults };
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    merged[key] = String(value);
  }
  return merged;
}
