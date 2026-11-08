import type { ControlProps } from "@x-ac/design-react";

// 原生动作组件：点击通过 onClick 上抛，引擎转成 node-event 只读通知。
export function NativeButton(props: ControlProps) {
  const label = (props.label as string) ?? "按钮";
  const kind = (props.type as string) ?? "default";
  return (
    <button className={`nx-btn nx-btn--${kind}`} onClick={props.onClick}>
      {label}
    </button>
  );
}
