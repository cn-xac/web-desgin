/**
 * 设计器自身控件：适配包 designer kit 优先，缺失回落原生实现。
 *
 * 与 Vue 的 useDesignerUi / UiControl 同一套槽位（DESIGNER_SLOTS），
 * 差别只在 React 的受控通道统一为 `value` + `onChange(value)`。
 * 这样 react-* 扩展仓实现一个控件时不必关心引擎内部状态怎么存。
 */
import { createElement } from "react";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import { DESIGNER_SLOTS } from "@x-ac/web-design-core";
import type { DesignerKit, DesignerSlot, UiAdapter } from "@x-ac/web-design-core";
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
  /**
   * 下拉可搜索（元素多时输入关键字过滤）。
   * 原生 select 不支持，仅作占位：与 Vue 的 NativeSelect 同约定，
   * 宿主适配包（antd 的 showSearch / EP 的 filterable）接住即可生效。
   */
  filterable?: boolean;
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
  // filterable（可搜索）原生 select 无对应能力，这里刻意不取用：与 Vue 的 NativeSelect 一致，
  // 该开关只在适配包接住时才生效，回落实现静默忽略，不影响取值与回填。
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

/**
 * 已告警的适配包实例：SchemaDesigner 每次挂载都会解析控件表，
 * 用 WeakSet 按适配包实例去重，保证「一个适配包只提示一次」，不刷屏。
 */
const warnedAdapters = new WeakSet<object>();

/**
 * 适配包注入了却没带 designer kit 时，给一次可见提示（不阻断、不抛错）。
 * 与 Vue 的 warnMissingDesignerKit 对称：回落原生是既定容错能力，设计器照常可用，
 * 但「设计时与运行时同观感」的约定被打破，需要显式暴露给适配层作者。
 *
 * 触发条件刻意收窄：adapter 为 null（纯运行时 / 裸引擎）、或 designer 只覆盖部分槽位
 * （createDesignerKit 的合法用法）都不报；仅整个 designer 缺失时提示一次。
 */
function warnMissingDesignerKit(adapter: UiAdapter<ReactMaterial> | null): void {
  if (!adapter || adapter.designer || warnedAdapters.has(adapter)) return;
  warnedAdapters.add(adapter);
  // eslint-disable-next-line no-console
  console.warn(
    `[@x-ac/web-design-react] 适配包「${adapter.name}」未注册 designer kit：` +
      `设计器控件已回落到内置原生实现（功能仍可用），但属性设置面板与运行时 UI 库观感不一致。` +
      `请在 defineReactAdapter({ ..., designer: createDesignerKit({ Button, Input, Select, ... }) }) 中补齐。`,
  );
}

/** 解析「适配包实现 ?? 原生实现」，对齐 Vue 的 useDesignerUi() */
export function resolveDesignerUi(adapter: UiAdapter<ReactMaterial> | null): Record<DesignerSlot, Control> {
  warnMissingDesignerKit(adapter);
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
