import type { ControlProps } from "@x-ac/design-react";

/**
 * 业务物料示例（React 版）。
 *
 * 与 Vue 示例里的 RiskBadge 对应：组件实现完全由业务自己写，
 * 引擎只管「Schema 里写了 biz-priority，就去找注册进来的这个组件」。
 *
 * 约定：style 必须落在根元素上——通用间距与物料默认样式都通过它生效。
 */
export function PriorityTag({ level = "中", style }: ControlProps) {
  const tone = level === "高" ? "high" : level === "低" ? "low" : "mid";
  return (
    <span className={`demo-priority demo-priority--${tone}`} style={style}>
      优先级：{String(level)}
    </span>
  );
}
