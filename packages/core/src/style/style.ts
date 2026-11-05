/**
 * 样式解析：把 schema 的 style 归一化成「框架可消费的 CSS 声明表」。
 * 返回纯 Record<string, string>，Vue 直接 :style，React 直接 style={{}}，
 * 导出成静态 HTML 时也能拼成 style="..."。
 */

import { normalizeLength, readSpacing, SPACING_SIDES, type SpacingKey } from "./spacing";
import { resolveDefaultStyle } from "../materials/catalog";

export type CssStyle = Record<string, string>;

const SIZE_MAP: Record<string, string> = {
  small: "12px",
  default: "14px",
  large: "16px",
};

/** 这些属性的纯数字值需要补 px（Vue 只对部分属性自动补，导出 CSS 文本时必须显式） */
const LENGTH_KEYS = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "fontSize",
  "lineHeight",
  "borderRadius",
  "borderWidth",
  "gap",
  "rowGap",
  "columnGap",
  "top",
  "right",
  "bottom",
  "left",
]);

/**
 * 由组件属性推导出的布局样式（只发生在渲染期，不落库）。
 * 单独抽出来的原因：这类样式是「组件的视觉契约」，不应污染 Schema。
 */
export function propStyle(component: string, props: Record<string, unknown>): CssStyle {
  const style: CssStyle = {};

  switch (component) {
    case "container": {
      if (props.padding !== undefined) style.padding = `${Number(props.padding) || 0}px`;
      if (props.background) style.background = String(props.background);
      if (props.borderRadius !== undefined) style.borderRadius = `${Number(props.borderRadius) || 0}px`;
      break;
    }
    case "grid": {
      const columns = Math.max(1, Number(props.columns) || 1);
      style.display = "grid";
      style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      style.rowGap = `${Number(props.gap ?? 16)}px`;
      const columnGap = props.columnGap === undefined || props.columnGap === 0 ? props.gap : props.columnGap;
      style.columnGap = `${Number(columnGap ?? 16)}px`;
      break;
    }
    case "text": {
      const size = String(props.size ?? "default");
      style.fontSize = SIZE_MAP[size] ?? "14px";
      style.color = props.muted ? "var(--wb-ink3)" : "var(--wb-ink2)";
      style.lineHeight = "1.7";
      break;
    }
    case "image": {
      if (props.width !== undefined) style.width = `${Number(props.width) || 240}px`;
      if (props.radius !== undefined) style.borderRadius = `${Number(props.radius) || 0}px`;
      break;
    }
    case "button": {
      if (props.block) style.width = "100%";
      break;
    }
    default:
      break;
  }

  return style;
}

/** 归一化任意 style 对象：空值剔除、长度补单位、margin/padding 收敛 */
export function normalizeStyle(input: Record<string, unknown> | undefined): CssStyle {
  const out: CssStyle = {};
  if (!input) return out;

  for (const [key, value] of Object.entries(input)) {
    if (key === "margin" || key === "padding") continue;
    if (value === undefined || value === null || value === "") continue;
    out[key] = LENGTH_KEYS.has(key) ? normalizeLength(value) : String(value);
  }

  for (const key of ["margin", "padding"] as SpacingKey[]) {
    const { box, mode } = readSpacing(input, key);
    if (mode === "unset") continue;
    if (mode === "shorthand") {
      const parts = SPACING_SIDES.map((side) => box[side]);
      out[key] = collapse(parts);
      continue;
    }
    for (const side of SPACING_SIDES) {
      if (box[side]) out[key + side.charAt(0).toUpperCase() + side.slice(1)] = box[side];
    }
  }

  return out;
}

function collapse(parts: string[]): string {
  const [top, right, bottom, left] = parts;
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/**
 * 渲染器最终样式：组件契约样式 → 物料默认样式（含通用间距）→ 节点 style（含表达式求值）。
 * `resolve` 由渲染层提供，core 不关心表达式在什么框架里求值。
 */
export function resolveNodeStyle(
  component: string,
  props: Record<string, unknown>,
  style: Record<string, unknown> | undefined,
  resolve: (value: unknown) => unknown = (value) => value,
): CssStyle {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    resolved[key] = resolve(value);
  }

  return {
    ...propStyle(component, props),
    ...normalizeStyle(resolveDefaultStyle(component, undefined)),
    ...normalizeStyle(resolved),
  };
}

/** 导出静态 CSS 文本（style 属性值） */
export function styleToCssText(style: Record<string, string>): string {
  return Object.entries(style)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${kebab(key)}:${value}`)
    .join(";");
}

export function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** 内部消费、不应透传给 Element Plus 的属性 */
export const INTERNAL_PROP_KEYS = new Set(["label", "required", "tip", "block", "radius"]);

/** 这些属性的值需要做表达式解析后再交给组件 */
export function isBindable(key: string): boolean {
  return !["disabled", "required", "clearable", "block"].includes(key);
}
