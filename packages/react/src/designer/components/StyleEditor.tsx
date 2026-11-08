/**
 * 样式面板：间距（margin / padding）、内联样式、显示与循环指令。
 * 与 Vue 版 StyleEditor.vue 功能对齐，差异只在 React 的受控通道 value / onChange。
 */
import { useEffect, useState } from "react";
import {
  emptySpacing,
  formatSpacing,
  normalizeLength,
  readSpacing,
  SPACING_PRESETS,
  SPACING_SIDES,
} from "@x-ac/design-core";
import type { SpacingBox, SpacingKey, SpacingSide } from "@x-ac/design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

interface StyleField {
  key: string;
  label: string;
  type: "text" | "color" | "select";
  placeholder?: string;
  options?: string[];
}

/** margin / padding 由下面的间距编辑器接管，这里只放其它内联样式 */
const STYLE_FIELDS: StyleField[] = [
  { key: "width", label: "宽度", type: "text", placeholder: "如 100% / 320px" },
  { key: "background", label: "背景色", type: "color" },
  { key: "color", label: "文字色", type: "color" },
  { key: "fontSize", label: "字号", type: "text", placeholder: "如 14px" },
  { key: "textAlign", label: "对齐", type: "select", options: ["left", "center", "right"] },
  { key: "borderRadius", label: "圆角", type: "text", placeholder: "如 8px" },
];

const DIRECTIVES: Array<{
  name: "show" | "if" | "for";
  label: string;
  tip: string;
  placeholder: string;
}> = [
  { name: "show", label: "显示条件", tip: "不满足时渲染但隐藏，如 list.length > 0", placeholder: "list.length > 0" },
  { name: "if", label: "渲染条件", tip: "不满足时完全不渲染，适合有明显副作用的组件", placeholder: "form.type === 'a'" },
  { name: "for", label: "循环数据", tip: "绑定数组，子组件内用 item / index 访问", placeholder: "{{list}}" },
];

type SpacingMode = "uniform" | "pair" | "free";

/** 三种编辑粒度：统一（1 个值）→ 上下/左右（2 个值）→ 分边（4 个值） */
const SPACING_MODES: Array<{ value: SpacingMode; label: string; title: string }> = [
  { value: "uniform", label: "统一", title: "四边用同一个值" },
  { value: "pair", label: "上下/左右", title: "上下绑定、左右绑定，共两个值" },
  { value: "free", label: "分边", title: "上 / 右 / 下 / 左 分别设置" },
];

const SPACING_KEYS: SpacingKey[] = ["margin", "padding"];
const SIDE_LABEL: Record<SpacingSide, string> = { top: "上", right: "右", bottom: "下", left: "左" };

/** 按现有四边值猜初始模式：全等/全空 → 统一；上下相等且左右相等 → 绑定对；其余 → 分边 */
function guessMode(box: SpacingBox): SpacingMode {
  if (SPACING_SIDES.every((side) => box[side] === "")) return "uniform";
  if (SPACING_SIDES.every((side) => box[side] === box.top)) return "uniform";
  if (box.top === box.bottom && box.left === box.right) return "pair";
  return "free";
}

export function StyleEditor() {
  const { store, state } = useDesigner();
  const node = state.selectedNode;
  const selectedId = node?.id;

  const [modes, setModes] = useState<Record<SpacingKey, SpacingMode>>({
    margin: "uniform",
    padding: "uniform",
  });

  // 只在切换选中节点时按数据形态重置模式（对齐 Vue 的 immediate watch）；
  // 依赖刻意只放 id：node 引用每次编辑都会变，放进去会把用户手选的模式冲掉。
  useEffect(() => {
    const style = node?.style;
    setModes({
      margin: guessMode(readSpacing(style, "margin").box),
      padding: guessMode(readSpacing(style, "padding").box),
    });
  }, [selectedId]);

  if (!node) {
    return (
      <div className="style">
        <div className="style__tip-line">请先在画布中选中一个组件</div>
      </div>
    );
  }

  const boxes: Record<SpacingKey, SpacingBox> = {
    margin: readSpacing(node.style, "margin").box,
    padding: readSpacing(node.style, "padding").box,
  };
  // 统一模式的输入值：四边一致时是单值，不一致时是简写（如 8px 12px）
  const linkedValue: Record<SpacingKey, string> = {
    margin: formatSpacing(boxes.margin),
    padding: formatSpacing(boxes.padding),
  };

  const setMode = (key: SpacingKey, mode: SpacingMode): void => {
    setModes((prev) => {
      const next = { ...prev };
      next[key] = mode;
      return next;
    });
  };

  /** 统一模式：一个值铺四边，赋值前用 normalizeLength 补齐单位 */
  const setUniform = (key: SpacingKey, value: string): void => {
    const length = normalizeLength(value);
    store.updateSpacing(key, { top: length, right: length, bottom: length, left: length });
  };

  /** 绑定对：v 同时改上下，h 同时改左右 */
  const setPair = (key: SpacingKey, axis: "v" | "h", value: string): void => {
    const length = normalizeLength(value);
    const box = boxes[key];
    const next: SpacingBox =
      axis === "v" ? { ...box, top: length, bottom: length } : { ...box, left: length, right: length };
    store.updateSpacing(key, next);
  };

  const setSide = (key: SpacingKey, side: SpacingSide, value: string): void => {
    const next: SpacingBox = { ...boxes[key], [side]: normalizeLength(value) };
    store.updateSpacing(key, next);
  };

  const clearSpacing = (key: SpacingKey): void => {
    store.updateSpacing(key, emptySpacing());
  };

  /** 快捷预设：0 保持无单位，其余补 px；scope 决定铺到四边 / 上下 / 左右 */
  const applyPreset = (key: SpacingKey, px: number, scope: "all" | "v" | "h" = "all"): void => {
    const value = px === 0 ? "0" : `${px}px`;
    if (scope === "v") return setPair(key, "v", value);
    if (scope === "h") return setPair(key, "h", value);
    setUniform(key, value);
  };

  const styleValue = (key: string): string => {
    const value = node.style?.[key];
    return value === undefined || value === null ? "" : String(value);
  };

  const directiveValue = (name: "show" | "if" | "for"): string =>
    node.directives?.find((item) => item.name === name)?.value ?? "";

  return (
    <div className="style">
      <div className="style__section">间距（所有组件通用）</div>

      {SPACING_KEYS.map((key) => (
        <div className="box" key={key}>
          <div className="box__head">
            <span className="box__title">{key === "margin" ? "外边距 Margin" : "内边距 Padding"}</span>
            <div className="box__actions">
              <div className="box__modes">
                {SPACING_MODES.map((mode) => (
                  <button
                    type="button"
                    key={mode.value}
                    className={`box__mode${modes[key] === mode.value ? " is-on" : ""}`}
                    title={mode.title}
                    onClick={() => setMode(key, mode.value)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button type="button" className="box__clear" title="清除" onClick={() => clearSpacing(key)}>
                清除
              </button>
            </div>
          </div>

          {modes[key] === "uniform" ? (
            <div className="box__single">
              <UiControl
                as="Input"
                size="small"
                value={linkedValue[key]}
                placeholder="如 8 / 8px / auto"
                onChange={(v: unknown) => setUniform(key, String(v ?? ""))}
              />
            </div>
          ) : null}

          {modes[key] === "pair" ? (
            <div className="box__pair">
              <label className="box__pair-row">
                <span>上下</span>
                <UiControl
                  as="Input"
                  size="small"
                  value={boxes[key].top}
                  placeholder="如 8 / 8px"
                  onChange={(v: unknown) => setPair(key, "v", String(v ?? ""))}
                />
              </label>
              <label className="box__pair-row">
                <span>左右</span>
                <UiControl
                  as="Input"
                  size="small"
                  value={boxes[key].left}
                  placeholder="如 12 / 12px"
                  onChange={(v: unknown) => setPair(key, "h", String(v ?? ""))}
                />
              </label>
            </div>
          ) : null}

          {modes[key] === "free" ? (
            <div className="box__grid">
              {SPACING_SIDES.map((side) => (
                <label className="box__cell" key={side}>
                  <span>{SIDE_LABEL[side]}</span>
                  <UiControl
                    as="Input"
                    size="small"
                    value={boxes[key][side]}
                    placeholder="0"
                    onChange={(v: unknown) => setSide(key, side, String(v ?? ""))}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="box__presets">
            {modes[key] === "pair" ? (
              (["v", "h"] as const).map((axis) => (
                <div className="box__preset-row" key={axis}>
                  <span>{axis === "v" ? "上下" : "左右"}</span>
                  {SPACING_PRESETS.map((px) => (
                    <button
                      type="button"
                      className="box__preset"
                      key={`${key}-${axis}-${px}`}
                      title={`${px}px`}
                      onClick={() => applyPreset(key, px, axis)}
                    >
                      {px}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="box__preset-row">
                <span>全部</span>
                {SPACING_PRESETS.map((px) => (
                  <button
                    type="button"
                    className="box__preset"
                    key={`${key}-${px}`}
                    title={`${px}px`}
                    onClick={() => applyPreset(key, px)}
                  >
                    {px}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="style__tip-line">
        写入节点 <code>style</code>，导出的 JSON 在 Vue / React / 原生 HTML 中都是同一套 CSS。
      </div>

      <div className="style__section">内联样式</div>
      {STYLE_FIELDS.map((field) => (
        <div className="style__row" key={field.key}>
          <label>{field.label}</label>
          {field.type === "color" ? (
            <UiControl
              as="ColorInput"
              size="small"
              showAlpha
              value={styleValue(field.key)}
              onChange={(v: unknown) => store.updateStyle(field.key, String(v ?? ""))}
            />
          ) : field.type === "select" ? (
            <UiControl
              as="Select"
              size="small"
              clearable
              placeholder="默认"
              value={styleValue(field.key)}
              options={(field.options ?? []).map((option) => ({ label: option, value: option }))}
              onChange={(v: unknown) => store.updateStyle(field.key, String(v ?? ""))}
            />
          ) : (
            <UiControl
              as="Input"
              size="small"
              value={styleValue(field.key)}
              placeholder={field.placeholder}
              onChange={(v: unknown) => store.updateStyle(field.key, String(v ?? ""))}
            />
          )}
        </div>
      ))}

      <div className="style__section">显示与循环</div>
      {DIRECTIVES.map((directive) => (
        <div className="style__row style__row--block" key={directive.name}>
          <label>{directive.label}</label>
          <UiControl
            as="Input"
            size="small"
            value={directiveValue(directive.name)}
            placeholder={directive.placeholder}
            onChange={(v: unknown) => store.setDirective(directive.name, String(v ?? ""))}
          />
          <div className="style__tip">{directive.tip}</div>
        </div>
      ))}

      <div className="style__section">预览元素</div>
      <pre className="style__preview">
        {JSON.stringify({ style: node.style ?? {}, directives: node.directives ?? [] }, null, 2)}
      </pre>
    </div>
  );
}
