/**
 * Element Plus 对既有物料的属性补丁。
 *
 * core 的 MATERIALS 只放「各库通用」的字段；这里补 EP 专有属性。
 * 同名字段会**覆盖** core 的定义（见 core 的 mergeFields）：这样扩充枚举选项
 * （比如日期类型）只需要在这里再写一次，不会在面板里出现两个同名输入框。
 *
 * 取舍原则：
 * - 只补「能真实生效」的属性：名字必须与 EP 组件的 prop 一致，否则设了也不动；
 * - 函数类（formatter / beforeChange / filterMethod）与组件类（icon / suffixIcon）
 *   一律不补：Schema 是 JSON，存不了函数与组件实例。硬塞字符串只会得到一个
 *   「看起来能设、其实没效果」的假开关，比不提供更糟；
 * - 所有字段显式标注 group 与 portability，不依赖键名推断。
 */
import type { PropField } from "@x-ac/design-core";

const SIZE_OPTIONS = [
  { label: "大", value: "large" },
  { label: "默认", value: "default" },
  { label: "小", value: "small" },
];

const PLACEMENT_OPTIONS = [
  { label: "上", value: "top" },
  { label: "上起", value: "top-start" },
  { label: "上末", value: "top-end" },
  { label: "下", value: "bottom" },
  { label: "下起", value: "bottom-start" },
  { label: "下末", value: "bottom-end" },
];

/** 表单控件几乎都有的三项，拼在各自字段表末尾 */
const COMMON_CONTROL: PropField[] = [
  { key: "size", label: "尺寸", type: "select", options: SIZE_OPTIONS, group: "basic", portability: "visual" },
  { key: "clearable", label: "可清空", type: "boolean", group: "basic", portability: "behavior" },
];

export const EP_FIELD_PATCHES: Record<string, PropField[]> = {
  /* ---------------- 输入类 ---------------- */
  input: [
    {
      key: "type",
      label: "输入类型",
      type: "select",
      options: [
        { label: "文本", value: "text" },
        { label: "密码", value: "password" },
        { label: "数字", value: "number" },
        { label: "邮箱", value: "email" },
        { label: "电话", value: "tel" },
        { label: "网址", value: "url" },
        { label: "搜索", value: "search" },
      ],
      group: "basic",
      portability: "behavior",
      tip: "决定浏览器键盘与原生行为，密码框会走 EP 的密码切换逻辑",
    },
    { key: "readonly", label: "只读", type: "boolean", group: "basic", portability: "behavior" },
    { key: "showWordLimit", label: "字数统计", type: "boolean", group: "advanced", portability: "behavior" },
    { key: "showPassword", label: "密码可见切换", type: "boolean", group: "advanced", portability: "behavior" },
    {
      key: "wordLimitPosition",
      label: "字数位置",
      type: "select",
      options: [
        { label: "框内", value: "inside" },
        { label: "框外", value: "outside" },
      ],
      group: "advanced",
      portability: "visual",
    },
    { key: "minlength", label: "最小长度", type: "number", min: 0, group: "advanced", portability: "behavior" },
    { key: "autofocus", label: "自动聚焦", type: "boolean", group: "advanced", portability: "visual" },
    {
      key: "autocomplete",
      label: "自动填充",
      type: "select",
      options: [
        { label: "关闭", value: "off" },
        { label: "开启", value: "on" },
      ],
      group: "advanced",
      portability: "visual",
    },
  ],
  textarea: [
    { key: "showWordLimit", label: "字数统计", type: "boolean", group: "basic", portability: "behavior" },
    { key: "autosize", label: "高度自适应", type: "boolean", group: "basic", portability: "visual" },
    { key: "readonly", label: "只读", type: "boolean", group: "advanced", portability: "behavior" },
    {
      key: "wordLimitPosition",
      label: "字数位置",
      type: "select",
      options: [
        { label: "框内", value: "inside" },
        { label: "框外", value: "outside" },
      ],
      group: "advanced",
      portability: "visual",
    },
    { key: "minlength", label: "最小长度", type: "number", min: 0, group: "advanced", portability: "behavior" },
    { key: "autofocus", label: "自动聚焦", type: "boolean", group: "advanced", portability: "visual" },
  ],
  number: [
    { key: "placeholder", label: "占位提示", type: "text", group: "basic", portability: "content" },
    { key: "readonly", label: "只读", type: "boolean", group: "advanced", portability: "behavior" },
    { key: "stepStrictly", label: "只允许步长", type: "boolean", group: "advanced", portability: "behavior" },
    {
      key: "align",
      label: "文字对齐",
      type: "select",
      options: [
        { label: "左", value: "left" },
        { label: "居中", value: "center" },
        { label: "右", value: "right" },
      ],
      group: "style",
      portability: "visual",
    },
    { key: "disabledScientific", label: "禁止科学计数", type: "boolean", group: "advanced", portability: "behavior" },
  ],
  select: [
    { key: "multiple", label: "多选", type: "boolean", group: "basic", portability: "behavior" },
    { key: "filterable", label: "可搜索", type: "boolean", group: "basic", portability: "behavior" },
    { key: "allowCreate", label: "允许新建选项", type: "boolean", group: "advanced", portability: "behavior", tip: "需同时打开「可搜索」" },
    { key: "multipleLimit", label: "最多选几项", type: "number", min: 0, group: "advanced", portability: "behavior", tip: "0 表示不限制" },
    { key: "collapseTags", label: "多选折叠标签", type: "boolean", group: "advanced", portability: "visual" },
    { key: "collapseTagsTooltip", label: "折叠显示全部", type: "boolean", group: "advanced", portability: "visual" },
    { key: "size", label: "尺寸", type: "select", options: SIZE_OPTIONS, group: "basic", portability: "visual" },
    {
      key: "effect",
      label: "下拉风格",
      type: "select",
      options: [
        { label: "浅色", value: "light" },
        { label: "深色", value: "dark" },
      ],
      group: "style",
      portability: "visual",
    },
    { key: "showArrow", label: "显示箭头", type: "boolean", group: "style", portability: "visual" },
    { key: "fitInputWidth", label: "下拉同宽", type: "boolean", group: "style", portability: "visual" },
    { key: "reserveKeyword", label: "保留搜索词", type: "boolean", group: "advanced", portability: "visual" },
    { key: "automaticDropdown", label: "聚焦即展开", type: "boolean", group: "advanced", portability: "visual" },
    { key: "loading", label: "加载中", type: "boolean", group: "advanced", portability: "visual" },
    { key: "loadingText", label: "加载文案", type: "text", group: "advanced", portability: "content" },
    { key: "noDataText", label: "无选项文案", type: "text", group: "advanced", portability: "content" },
    { key: "noMatchText", label: "无匹配文案", type: "text", group: "advanced", portability: "content" },
    { key: "placement", label: "下拉方向", type: "select", options: PLACEMENT_OPTIONS, group: "advanced", portability: "visual" },
  ],
  radio: [
    ...COMMON_CONTROL.filter((field) => field.key === "size"),
    {
      key: "variant",
      label: "样式",
      type: "select",
      options: [
        { label: "圆点", value: "default" },
        { label: "按钮组", value: "button" },
      ],
      group: "style",
      portability: "visual",
    },
    { key: "border", label: "带边框", type: "boolean", group: "style", portability: "visual" },
    { key: "textColor", label: "选中文字色", type: "color", group: "style", portability: "visual" },
    { key: "fill", label: "选中底色", type: "color", group: "style", portability: "visual" },
  ],
  checkbox: [
    ...COMMON_CONTROL.filter((field) => field.key === "size"),
    {
      key: "variant",
      label: "样式",
      type: "select",
      options: [
        { label: "方框", value: "default" },
        { label: "按钮组", value: "button" },
      ],
      group: "style",
      portability: "visual",
    },
    { key: "border", label: "带边框", type: "boolean", group: "style", portability: "visual" },
    { key: "min", label: "最少选几项", type: "number", min: 0, group: "advanced", portability: "behavior" },
    { key: "max", label: "最多选几项", type: "number", min: 0, group: "advanced", portability: "behavior" },
  ],
  switch: [
    { key: "loading", label: "加载中", type: "boolean", group: "advanced", portability: "visual" },
    { key: "size", label: "尺寸", type: "select", options: SIZE_OPTIONS, group: "basic", portability: "visual" },
    { key: "width", label: "宽度(px)", type: "number", min: 0, group: "style", portability: "visual" },
    {
      key: "activeValue",
      label: "打开时的值",
      type: "text",
      group: "data",
      portability: "behavior",
      tip: "留空表示布尔 true；填 1 / yes 这类值时会按字符串写回数据",
    },
    {
      key: "inactiveValue",
      label: "关闭时的值",
      type: "text",
      group: "data",
      portability: "behavior",
      tip: "留空表示布尔 false",
    },
  ],
  date: [
    {
      key: "type",
      label: "选择类型",
      type: "select",
      options: [
        { label: "日期", value: "date" },
        { label: "日期区间", value: "daterange" },
        { label: "日期时间", value: "datetime" },
        { label: "日期时间区间", value: "datetimerange" },
        { label: "月份", value: "month" },
        { label: "月份区间", value: "monthrange" },
        { label: "年份", value: "year" },
        { label: "周", value: "week" },
      ],
      group: "basic",
      portability: "behavior",
    },
    { key: "placeholder", label: "占位提示", type: "text", group: "basic", portability: "content" },
    { key: "startPlaceholder", label: "开始占位", type: "text", group: "content", portability: "content", tip: "仅区间类型生效" },
    { key: "endPlaceholder", label: "结束占位", type: "text", group: "content", portability: "content", tip: "仅区间类型生效" },
    { key: "unlinkPanels", label: "区间面板联动", type: "boolean", group: "advanced", portability: "visual", tip: "关闭后左右面板各自翻月" },
    {
      key: "size",
      label: "尺寸",
      type: "select",
      options: SIZE_OPTIONS,
      group: "basic",
      portability: "visual",
    },
  ],
  rate: [
    { key: "showText", label: "显示辅助文字", type: "boolean", group: "style", portability: "visual" },
    { key: "clearable", label: "可清零", type: "boolean", group: "basic", portability: "behavior" },
    { key: "size", label: "尺寸", type: "select", options: SIZE_OPTIONS, group: "basic", portability: "visual" },
    { key: "textColor", label: "文字颜色", type: "color", group: "style", portability: "visual" },
    { key: "voidColor", label: "未选颜色", type: "color", group: "style", portability: "visual" },
  ],
  slider: [
    { key: "showInput", label: "显示输入框", type: "boolean", group: "advanced", portability: "visual" },
    { key: "showInputControls", label: "显示步进按钮", type: "boolean", group: "advanced", portability: "visual" },
    { key: "showStops", label: "显示间断点", type: "boolean", group: "style", portability: "visual" },
    { key: "vertical", label: "竖向", type: "boolean", group: "style", portability: "visual" },
    { key: "height", label: "竖向高度(px)", type: "number", min: 0, group: "style", portability: "visual" },
    { key: "placement", label: "提示方向", type: "select", options: PLACEMENT_OPTIONS, group: "advanced", portability: "visual" },
  ],

  /* ---------------- 展示与交互 ---------------- */
  button: [
    { key: "link", label: "文字按钮", type: "boolean", group: "style", portability: "visual" },
    { key: "bg", label: "常显文字底色", type: "boolean", group: "style", portability: "visual" },
    { key: "dashed", label: "虚线边框", type: "boolean", group: "style", portability: "visual" },
    { key: "color", label: "自定义颜色", type: "color", group: "style", portability: "visual" },
    { key: "dark", label: "深色模式色", type: "boolean", group: "style", portability: "visual", tip: "配合自定义颜色使用" },
    { key: "loading", label: "加载中", type: "boolean", group: "advanced", portability: "behavior" },
    { key: "round", label: "圆角", type: "boolean", group: "style", portability: "visual" },
    { key: "circle", label: "圆形", type: "boolean", group: "style", portability: "visual" },
    {
      key: "nativeType",
      label: "原生类型",
      type: "select",
      options: [
        { label: "button", value: "button" },
        { label: "submit", value: "submit" },
        { label: "reset", value: "reset" },
      ],
      group: "advanced",
      portability: "behavior",
    },
    { key: "autoInsertSpace", label: "中文自动加空格", type: "boolean", group: "advanced", portability: "visual" },
  ],
  link: [
    { key: "target", label: "打开方式", type: "select", options: [
      { label: "当前窗口", value: "_self" },
      { label: "新窗口", value: "_blank" },
      { label: "父窗口", value: "_parent" },
      { label: "顶层窗口", value: "_top" },
    ], group: "basic", portability: "behavior" },
  ],
  tag: [
    { key: "round", label: "圆角", type: "boolean", group: "style", portability: "visual" },
    { key: "hit", label: "高亮边框", type: "boolean", group: "style", portability: "visual" },
    { key: "color", label: "自定义底色", type: "color", group: "style", portability: "visual" },
    { key: "disableTransitions", label: "关闭过渡动画", type: "boolean", group: "advanced", portability: "visual" },
  ],
  alert: [{ key: "closeText", label: "关闭按钮文案", type: "text", group: "advanced", portability: "content" }],
  image: [
    { key: "preview", label: "点击预览", type: "boolean", group: "basic", portability: "visual" },
    { key: "hideOnClickModal", label: "点遮罩关闭预览", type: "boolean", group: "advanced", portability: "visual" },
    { key: "infinite", label: "预览循环", type: "boolean", group: "advanced", portability: "visual" },
    { key: "zoomRate", label: "缩放速率", type: "number", step: 0.1, group: "advanced", portability: "visual" },
    { key: "showProgress", label: "预览显示进度", type: "boolean", group: "advanced", portability: "visual" },
    { key: "lazy", label: "懒加载", type: "boolean", group: "advanced", portability: "behavior" },
  ],
  space: [
    { key: "fill", label: "撑满容器", type: "boolean", group: "style", portability: "visual" },
    { key: "fillRatio", label: "撑满比例(%)", type: "number", min: 0, max: 100, group: "advanced", portability: "visual" },
  ],
  table: [
    { key: "size", label: "尺寸", type: "select", options: SIZE_OPTIONS, group: "style", portability: "visual" },
    { key: "height", label: "固定高度", type: "number", min: 0, group: "advanced", portability: "visual", tip: "填了表头固定、表体滚动" },
    { key: "maxHeight", label: "最大高度", type: "number", min: 0, group: "advanced", portability: "visual" },
    { key: "showHeader", label: "显示表头", type: "boolean", group: "advanced", portability: "visual" },
    { key: "highlightCurrentRow", label: "高亮当前行", type: "boolean", group: "advanced", portability: "visual" },
  ],
  text: [
    {
      key: "type",
      label: "语义色",
      type: "select",
      options: [
        { label: "默认", value: "" },
        { label: "主色", value: "primary" },
        { label: "成功", value: "success" },
        { label: "警告", value: "warning" },
        { label: "危险", value: "danger" },
        { label: "信息", value: "info" },
      ],
      group: "style",
      portability: "visual",
    },
    { key: "truncated", label: "超出省略", type: "boolean", group: "style", portability: "visual" },
    { key: "tag", label: "渲染标签", type: "text", group: "advanced", portability: "visual", tip: "如 span / p / h3" },
  ],
  card: [
    {
      key: "shadow",
      label: "阴影",
      type: "select",
      options: [
        { label: "从不", value: "never" },
        { label: "悬停", value: "hover" },
        { label: "总是", value: "always" },
      ],
      group: "style",
      portability: "visual",
    },
  ],
  divider: [
    {
      key: "borderStyle",
      label: "线型",
      type: "select",
      options: [
        { label: "实线", value: "solid" },
        { label: "虚线", value: "dashed" },
        { label: "点线", value: "dotted" },
      ],
      group: "style",
      portability: "visual",
    },
    {
      key: "direction",
      label: "方向",
      type: "select",
      options: [
        { label: "水平", value: "horizontal" },
        { label: "垂直", value: "vertical" },
      ],
      group: "style",
      portability: "visual",
    },
  ],
};
