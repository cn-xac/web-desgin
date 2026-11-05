/**
 * 间距（margin / padding）通用能力。
 *
 * 设计取舍：
 * - 不新增 schema 字段，仍然写进节点的 `style`（CSS 属性名），
 *   这样导出的 JSON 拿到 Vue / React / 原生 HTML 都能直接用；
 * - 四边相等时收敛成简写（`margin: 8px 12px`），不等时展开成
 *   `marginTop` 等长写，避免出现 `margin: 8px  4px` 这种缺边的非法简写。
 */

export type SpacingSide = "top" | "right" | "bottom" | "left";
export type SpacingKey = "margin" | "padding";

export interface SpacingBox {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export const SPACING_SIDES: SpacingSide[] = ["top", "right", "bottom", "left"];

const SIDE_SUFFIX: Record<SpacingSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

/** 设计器里给用户的常用档位（px） */
export const SPACING_PRESETS = [0, 4, 8, 12, 16, 24, 32];

export function emptySpacing(): SpacingBox {
  return { top: "", right: "", bottom: "", left: "" };
}

/** 统一长度写法：数字与纯数字字符串补 px（0 保持无单位），其余原样返回 */
export function normalizeLength(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return value === 0 ? "0" : `${value}px`;
  }
  const text = String(value).trim();
  if (!text) return "";
  if (!/^-?(?:\d+|\d*\.\d+)$/.test(text)) return text;
  return Number(text) === 0 ? "0" : `${text}px`;
}

/** `"8px 12px"` / `8` / `"8px 12px 4px 6px"` → 四边 */
export function parseSpacing(value: unknown): SpacingBox {
  if (value === undefined || value === null) return emptySpacing();
  const text = String(value).trim();
  if (!text) return emptySpacing();

  // 逐边归一化：`8 12 4` 这种写法同样要补成 px
  const parts = text.split(/\s+/).filter(Boolean).map(normalizeLength);
  const top = parts[0] ?? "";
  const right = parts[1] ?? top;
  const bottom = parts[2] ?? top;
  const left = parts[3] ?? right;
  return { top, right, bottom, left };
}

/** 四边 → 最简 CSS 简写 */
export function formatSpacing(box: SpacingBox): string {
  const { top, right, bottom, left } = box;
  if (!top && !right && !bottom && !left) return "";
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

export interface SpacingReadResult {
  box: SpacingBox;
  /** unset 表示从未设置过，简写/长写用于决定面板展示方式 */
  mode: "unset" | "shorthand" | "longhand";
}

/** 从 style 中读回四边：长写优先，缺失的边回落到简写 */
export function readSpacing(style: Record<string, unknown> | undefined, key: SpacingKey): SpacingReadResult {
  const shorthand = parseSpacing(style?.[key]);
  const box = { ...shorthand };
  let longhand = false;

  for (const side of SPACING_SIDES) {
    const raw = style?.[key + SIDE_SUFFIX[side]];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    box[side] = normalizeLength(raw);
    longhand = true;
  }

  const hasShorthand = SPACING_SIDES.some((side) => shorthand[side] !== "");
  const mode = longhand ? "longhand" : hasShorthand ? "shorthand" : "unset";
  return { box, mode };
}

/** 把四边写回 style（就地修改，供设计器的撤销栈统一管理） */
export function writeSpacing(style: Record<string, unknown>, key: SpacingKey, rawBox: SpacingBox): void {
  const box: SpacingBox = {
    top: normalizeLength(rawBox.top),
    right: normalizeLength(rawBox.right),
    bottom: normalizeLength(rawBox.bottom),
    left: normalizeLength(rawBox.left),
  };

  delete style[key];
  for (const side of SPACING_SIDES) delete style[key + SIDE_SUFFIX[side]];

  const filled = SPACING_SIDES.filter((side) => box[side] !== "");
  if (filled.length === 0) return;

  if (filled.length === 4 && SPACING_SIDES.every((side) => box[side] === box.top)) {
    style[key] = formatSpacing(box);
    return;
  }
  for (const side of filled) style[key + SIDE_SUFFIX[side]] = box[side];
}

/** 导出成 CSS 文本时使用的间距声明 */
export function spacingToCss(style: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};

  for (const key of ["margin", "padding"] as SpacingKey[]) {
    const { box, mode } = readSpacing(style, key);
    if (mode === "unset") continue;
    if (mode === "shorthand") {
      out[key] = formatSpacing(box);
      continue;
    }
    for (const side of SPACING_SIDES) {
      if (box[side]) out[key + SIDE_SUFFIX[side]] = box[side];
    }
  }

  return out;
}
