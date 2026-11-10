import type { ControlProps } from "@x-ac/web-design-react";

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

// 原生受控输入：遵循 React 默认绑定通道 value / onChange。
// 引擎把 Schema 里的 modelValue: "{{name}}" 表达式解析后，经此通道与页面数据双向同步。
export function NativeInput(props: ControlProps) {
  return (
    <input
      className="nx-input"
      value={str(props.value)}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  );
}
