/**
 * 显示 / 隐藏条件的入口（对齐 Vue StyleEditor 里的「条件摘要 + 配置」按钮）。
 *
 * 条件编辑本身在 ConditionDialog 里完成（弹窗形态，与 Vue 一致）；
 * 这里只负责展示摘要并把落点交给弹窗。
 *
 * 历史说明：React 侧原先用内联可折叠区块（导出名 ConditionBuilder），
 * 现已与 Vue 统一为弹窗；保留同名导出，避免宿主侧引用断裂。
 */
import { CONDITION_MODE_OPTIONS } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { useDesignerDialogs } from "../dialogs";

export function ConditionTrigger({ kind }: { kind: "show" | "hide" }) {
  const { state } = useDesigner();
  const dialogs = useDesignerDialogs();
  const node = state.selectedNode;
  if (!node) return null;

  const group = node.visibility?.[kind];
  const summary = (() => {
    if (!group?.rows.length) return "未配置";
    const mode = CONDITION_MODE_OPTIONS.find((option) => option.value === group.mode)?.label ?? group.mode;
    return `${group.rows.length} 条 · ${mode}`;
  })();

  return (
    <button
      type="button"
      className="style__cond-btn"
      onClick={() =>
        dialogs.openConditions({
          nodeId: node.id,
          label: String(node.props?.label ?? node.component),
          kind,
        })
      }
    >
      {summary} · 配置
    </button>
  );
}

/** 兼容旧导出名（原内联构造器） */
export const ConditionBuilder = ConditionTrigger;
