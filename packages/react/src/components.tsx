/**
 * React 物料映射。
 *
 * 刻意只用原生元素：不绑定任何 UI 库，宿主可以整体替换这张表
 * （例如换成 antd / MUI），渲染器与 Schema 完全不用改。
 *
 * 所有组件都必须把 `style` 应用到根元素上——通用 margin / padding 依赖这一点。
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { materialKey, parseOptions, prefixedComponents } from "@x-ac/web-design-core";

export interface ControlProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  disabled?: boolean;
  options?: unknown;
  children?: ReactNode;
  onClick?: () => void;
  onBlur?: () => void;
  style?: CSSProperties;
  [key: string]: unknown;
}

const str = (value: unknown): string => (value === undefined || value === null ? "" : String(value));

/* ---------------- 展示 ---------------- */

function Wrapper({ children, onClick, style }: ControlProps) {
  return (
    <div style={style} onClick={onClick}>
      {children}
    </div>
  );
}

const Heading = ({ children, style }: ControlProps) => (
  <h3 className="ux-heading" style={style}>
    {children}
  </h3>
);

const Paragraph = ({ children, style }: ControlProps) => (
  <p className="ux-text" style={style}>
    {children}
  </p>
);

const Divider = ({ style }: ControlProps) => <hr className="ux-divider" style={style} />;

const InlineTag = ({ children, style }: ControlProps) => (
  <span className="ux-tag" style={style}>
    {children}
  </span>
);

const Alert = ({ children, style }: ControlProps) => (
  <div className="ux-alert" style={style}>
    {children}
  </div>
);

const Picture = ({ src, alt, style }: ControlProps) => (
  <img className="ux-image" src={str(src)} alt={str(alt)} style={style} />
);

const TextLink = ({ href, children, style }: ControlProps) => (
  <a className="ux-link" href={str(href) || "#"} style={style}>
    {children}
  </a>
);

function CardBlock({ title, children, onClick, style }: ControlProps) {
  return (
    <section className="ux-card" style={style} onClick={onClick}>
      {title ? <header className="ux-card__header">{str(title)}</header> : null}
      <div className="ux-card__body">{children}</div>
    </section>
  );
}

interface TableColumn {
  label: string;
  prop: string;
  width?: string | number;
}

function parseColumns(raw: unknown): TableColumn[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return {
          label: str(record.label ?? record.prop),
          prop: str(record.prop ?? record.label),
          width: record.width as string | number | undefined,
        };
      })
      .filter((column) => column.prop !== "");
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [label, prop] = pair.split(":").map((s) => s.trim());
        return { label: label || prop, prop: prop || label };
      })
      .filter((column) => column.prop !== "");
  }
  return [];
}

function TableBlock({ columns, data, rows, emptyText, style }: ControlProps) {
  const headers = parseColumns(columns);
  const list = Array.isArray(data) ? data : Array.isArray(rows) ? rows : [];

  return (
    <table className="ux-table" style={style}>
      <thead>
        <tr>
          {headers.map((column) => (
            <th key={column.prop} style={column.width ? { width: column.width } : undefined}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {list.length === 0 ? (
          <tr>
            <td className="ux-table__empty" colSpan={Math.max(1, headers.length)}>
              {str(emptyText) || "暂无数据"}
            </td>
          </tr>
        ) : (
          list.map((row, index) => (
            <tr key={index}>
              {headers.map((column) => (
                <td key={column.prop}>{str((row as Record<string, unknown>)?.[column.prop])}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/* ---------------- 表单控件 ---------------- */

const Input = ({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  style,
  type = "text",
}: ControlProps & { type?: string }) => (
  <input
    className="ux-input"
    type={type}
    value={str(value)}
    placeholder={placeholder}
    disabled={Boolean(disabled)}
    style={style}
    onBlur={onBlur}
    onChange={(event) => onChange?.(type === "number" ? Number(event.target.value) : event.target.value)}
  />
);

const Textarea = ({ value, onChange, onBlur, placeholder, disabled, style }: ControlProps) => (
  <textarea
    className="ux-input ux-textarea"
    value={str(value)}
    placeholder={placeholder}
    disabled={Boolean(disabled)}
    style={style}
    onBlur={onBlur}
    onChange={(event) => onChange?.(event.target.value)}
  />
);

function Select({ value, onChange, onBlur, options, placeholder, disabled, style }: ControlProps) {
  return (
    <select
      className="ux-input"
      value={str(value)}
      disabled={Boolean(disabled)}
      style={style}
      onBlur={onBlur}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="">{str(placeholder) || "请选择"}</option>
      {parseOptions(options).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function RadioGroup({ value, onChange, options, disabled, style }: ControlProps) {
  return (
    <div className="ux-choices" style={style}>
      {parseOptions(options).map((option) => (
        <label key={option.value} className="ux-choice">
          <input
            type="radio"
            checked={str(value) === option.value}
            disabled={Boolean(disabled)}
            onChange={() => onChange?.(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ value, onChange, options, disabled, style }: ControlProps) {
  const selected = Array.isArray(value) ? value.map(str) : [];
  const toggle = (next: string): void => {
    const set = new Set(selected);
    if (set.has(next)) set.delete(next);
    else set.add(next);
    onChange?.(Array.from(set));
  };

  return (
    <div className="ux-choices" style={style}>
      {parseOptions(options).map((option) => (
        <label key={option.value} className="ux-choice">
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            disabled={Boolean(disabled)}
            onChange={() => toggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

const Switch = ({ value, onChange, disabled, style }: ControlProps) => (
  <input
    className="ux-switch"
    type="checkbox"
    checked={Boolean(value)}
    disabled={Boolean(disabled)}
    style={style}
    onChange={(event) => onChange?.(event.target.checked)}
  />
);

function Range({ value, onChange, onBlur, min, max, disabled, style }: ControlProps) {
  return (
    <input
      className="ux-range"
      type="range"
      value={Number(value ?? 0)}
      min={Number(min ?? 0)}
      max={Number(max ?? 100)}
      disabled={Boolean(disabled)}
      style={style}
      onBlur={onBlur}
      onChange={(event) => onChange?.(Number(event.target.value))}
    />
  );
}

const Button = ({ children, onClick, disabled, style }: ControlProps) => (
  <button className="ux-button" type="button" disabled={Boolean(disabled)} style={style} onClick={onClick}>
    {children}
  </button>
);

/** 业务组件在 React 侧的兜底实现：宿主可覆盖为真实选择器 */
const BusinessInput = (props: ControlProps) => <Input {...props} />;

/* ---------------- 映射表 ---------------- */

const COMPONENT_TABLE: Record<string, ComponentType<ControlProps>> = {
  container: Wrapper,
  grid: Wrapper,
  space: Wrapper,
  card: CardBlock,
  title: Heading,
  text: Paragraph,
  divider: Divider,
  tag: InlineTag,
  alert: Alert,
  image: Picture,
  table: TableBlock,

  input: Input,
  textarea: Textarea,
  number: (props) => <Input {...props} type="number" />,
  select: Select,
  radio: RadioGroup,
  checkbox: CheckboxGroup,
  switch: Switch,
  date: (props) => <Input {...props} type="date" />,
  rate: Range,
  slider: Range,

  button: Button,
  link: TextLink,

  "org-picker": BusinessInput,
  "dict-select": Select,
  "amount-input": (props) => <Input {...props} type="number" />,
};

/** 对外键统一加 `ec-` 前缀，与 Schema 里的协议物料名一致；归一化复用 core 的通用工具 */
export const COMPONENTS: Record<string, ComponentType<ControlProps>> = prefixedComponents(COMPONENT_TABLE);

/**
 * 按协议物料名查实现。
 *
 * 传了 `components` 就按那张表查 —— 渲染器实际走这条路径（适配包可能是换过的）。
 * 不传则查内置表，保持历史调用兼容。
 */
export function resolveComponent(
  component: string,
  components: Record<string, ComponentType<ControlProps>> = COMPONENTS,
): ComponentType<ControlProps> | null {
  return components[materialKey(component)] ?? components[component] ?? null;
}
