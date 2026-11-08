/**
 * 设计器自身控件：适配包 designer kit 优先，缺失回落原生实现。
 *
 * 与 Vue 的 useDesignerUi / UiControl 同一套槽位（DESIGNER_SLOTS），
 * 差别只在 React 的受控通道统一为 `value` + `onChange(value)`。
 * 这样 react-* 扩展仓实现一个控件时不必关心引擎内部状态怎么存。
 */
import { createElement } from "react";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import { DESIGNER_SLOTS } from "@x-ac/design-core";
import type { DesignerKit, DesignerSlot, UiAdapter } from "@x-ac/design-core";
import type { ReactMaterial } from "../adapter";
import { useDesigner } from "./context";
import type { DesignerNotifyType } from "./context";

export interface SelectOption {
  label: string;
  value: string | number;
}

/** 所有槽位共用的最小 props；各控件按需取用，多余字段透传给 DOM */
export interface DesignerControlProps {
  value?: unknown;
  onChange?: (value: any) => void;
  options?: Array<string | number | SelectOption>;
  type?: "default" | "primary" | "danger" | "text" | "number" | "color";
  size?: "small" | "default";
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  controls?: boolean;
  showAlpha?: boolean;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
  plain?: boolean;
}

type Control = ComponentType<DesignerControlProps>;

const normalizeOptions = (options: DesignerControlProps["options"] = []): SelectOption[] =>
  options.map((item) =>
    typeof item === "object" && item !== null && "label" in item
      ? item
      : { label: String(item), value: item as string | number },
  );

function NativeButton(props: DesignerControlProps) {
  const { type = "default", size = "small", disabled, className = "", onClick, children } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`wbd-btn wbd-btn--${type}${size === "small" ? " wbd-sm" : ""} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

function NativeInput(props: DesignerControlProps) {
  const { value, onChange, type, rows, placeholder, disabled, className = "" } = props;
  const shared = {
    value: value === undefined || value === null ? "" : String(value),
    placeholder,
    disabled,
    className: `wbd-input${rows && rows > 1 ? " wbd-input--area" : ""} ${className}`.trim(),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange?.(event.target.value),
  };
  return rows && rows > 1 ? <textarea {...shared} rows={rows} /> : <input {...shared} type={type === "number" ? "number" : "text"} />;
}

function NativeNumber(props: DesignerControlProps) {
  const { value, onChange, min, max, step, disabled, className = "" } = props;
  return (
    <input
      type="number"
      className={`wbd-number ${className}`.trim()}
      value={value === undefined || value === null ? "" : Number(value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        onChange?.(raw === "" ? undefined : Number(raw));
      }}
    />
  );
}

function NativeSelect(props: DesignerControlProps) {
  const { value, onChange, options, placeholder, clearable, disabled, className = "" } = props;
  const list = normalizeOptions(options);
  return (
    <select
      className={`wbd-select ${className}`.trim()}
      value={value === undefined || value === null ? "" : String(value)}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") return onChange?.(clearable ? undefined : "");
        const hit = list.find((option) => String(option.value) === raw);
        onChange?.(hit ? hit.value : raw);
      }}
    >
      {placeholder || clearable ? <option value="">{placeholder ?? "请选择"}</option> : null}
      {list.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function NativeSwitch(props: DesignerControlProps) {
  const { value, onChange, disabled } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(value)}
      disabled={disabled}
      className={`wbd-switch${value ? " is-on" : ""}`}
      onClick={() => onChange?.(!value)}
    />
  );
}

function NativeSegmented(props: DesignerControlProps) {
  const { value, onChange, options, size = "small" } = props;
  const list = normalizeOptions(options);
  return (
    <div className={`wbd-seg${size === "small" ? " wbd-sm" : ""}`}>
      {list.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`wbd-seg__item${String(value) === String(option.value) ? " is-on" : ""}`}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NativeColor(props: DesignerControlProps) {
  const { value, onChange, disabled } = props;
  const text = value === undefined || value === null ? "" : String(value);
  return (
    <div className="wbd-color">
      <input
        type="color"
        disabled={disabled}
        value={/^#[0-9a-f]{6}$/i.test(text) ? text : "#000000"}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <input
        type="text"
        className="wbd-input"
        disabled={disabled}
        value={text}
        placeholder="透明"
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}

const NATIVE: Record<DesignerSlot, Control> = {
  Button: NativeButton,
  Input: NativeInput,
  NumberInput: NativeNumber,
  Select: NativeSelect,
  Switch: NativeSwitch,
  Segmented: NativeSegmented,
  ColorInput: NativeColor,
};

/** 解析「适配包实现 ?? 原生实现」，对齐 Vue 的 useDesignerUi() */
export function resolveDesignerUi(adapter: UiAdapter<ReactMaterial> | null): Record<DesignerSlot, Control> {
  const kit = (adapter?.designer ?? {}) as DesignerKit<ComponentType<any>>;
  const resolved = {} as Record<DesignerSlot, Control>;
  for (const slot of DESIGNER_SLOTS) {
    resolved[slot] = (kit[slot] as Control | undefined) ?? NATIVE[slot];
  }
  return resolved;
}

/** 设计器提示：适配包 notify 优先，否则内置 1.8s 轻提示 */
export function resolveNotify(adapter: UiAdapter<ReactMaterial> | null) {
  const kit = (adapter?.designer ?? {}) as DesignerKit<ComponentType<any>>;
  if (kit.notify) return kit.notify;
  return (message: string, _type?: DesignerNotifyType) => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.className = "wbd-toast";
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 1800);
  };
}

/** 按槽位取当前生效控件，props 原样透传（对齐 Vue 的 UiControl.vue） */
export function UiControl({ as, children, ...props }: DesignerControlProps & { as: DesignerSlot }) {
  const { ui } = useDesigner();
  return createElement(ui[as], props, children);
}
