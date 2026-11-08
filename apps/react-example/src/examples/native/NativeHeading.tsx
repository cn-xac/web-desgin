import type { ControlProps } from "@x-ac/design-react";

// 原生展示组件：零 UI 库依赖，仅用原生标签。
// ControlProps 来自 @x-ac/design-react，value/children/text 等均通过索引签名透传。
export function NativeHeading(props: ControlProps) {
  const text = (props.text as string) ?? String(props.value ?? props.children ?? "");
  const level = (props.level as 1 | 2 | 3) ?? 2;
  const Tag = `h${level}` as "h1" | "h2" | "h3";
  return <Tag className="nx-heading">{text}</Tag>;
}
