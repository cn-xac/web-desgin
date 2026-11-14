/**
 * 通用多条件构造器弹窗（对齐 Vue 的 ConditionBuilder.vue，供「显示和隐藏逻辑」调用）。
 *
 * 数据模型与求值全部在 core，本组件只负责编辑 UI：
 * - 每行一个条件：序号 + 左元素 + 关系 + 右值；特殊场景可勾选「仅值」；
 * - 条件间：并且 / 或者 / 高级（按序号组合，如 1 and (2 or 3)）；
 * - 子表单内元素只能选同一子表单内的字段（core 的清单已裁剪）；
 * - 子表单外引用明细字段时显示聚合口径，缺省求和。
 *
 * 与适配包解耦：控件用原生 select / input，CI stub 环境也能真实点击测试。
 */
import { useMemo, useState } from "react";
import {
  CONDITION_AGGREGATES,
  CONDITION_MODE_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
  collectConditionElements,
  findLocation,
  validateAdvancedExpression,
} from "@x-ac/web-design-core";
import type { ConditionGroup, ConditionMode, ConditionRow, VisibilityConfig } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import type { ConditionTarget } from "../dialogs";
import { ModalShell } from "./ModalShell";

interface DraftRow extends ConditionRow {
  /** 仅 UI 状态：勾选后该行只有 value，不落库 */
  valueOnly?: boolean;
}

interface Draft {
  mode: ConditionMode;
  rows: DraftRow[];
  expression: string;
}

const blankRow = (): DraftRow => ({ left: "", operator: "eq", value: "", aggregate: "sum" });

function normalize(group: ConditionGroup | undefined): Draft {
  if (!group) return { mode: "and", rows: [blankRow()], expression: "" };
  return {
    mode: group.mode,
    expression: group.expression ?? "",
    rows: group.rows.map((row) => ({
      ...row,
      aggregate: row.aggregate ?? "sum",
      valueOnly: !row.left && !row.operator,
    })),
  };
}

export interface ConditionDialogProps {
  target: ConditionTarget;
  onClose: () => void;
}

export function ConditionDialog({ target, onClose }: ConditionDialogProps) {
  const { store, state, notify } = useDesigner();

  const initialGroup = findLocation(state.page.children ?? [], target.nodeId)?.node?.visibility?.[target.kind];
  const [draft, setDraft] = useState<Draft>(() => normalize(initialGroup));

  const elements = useMemo(
    () => collectConditionElements(state.page, { nodeId: target.nodeId }),
    [state.page, target.nodeId],
  );

  const expressionError =
    draft.mode === "advanced"
      ? validateAdvancedExpression(draft.expression ?? "", draft.rows.length) ?? ""
      : "";

  const scopeTip = elements.some((element) => element.inSubform)
    ? "可选元素已按所在子表单裁剪；引用明细字段时需指定聚合口径。"
    : "可选元素来自当前页面；引用子表单明细字段时需指定聚合口径。";

  const requiresAggregate = (left?: string): boolean =>
    elements.find((element) => element.path === left)?.requiresAggregate ?? false;

  const isUnary = (operator?: ConditionRow["operator"]): boolean =>
    CONDITION_OPERATOR_OPTIONS.find((option) => option.value === operator)?.unary ?? false;

  const patch = (partial: Partial<Draft>): void => setDraft((current) => ({ ...current, ...partial }));

  const updateRow = (index: number, partial: Partial<DraftRow>): void =>
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    }));

  function toggleValueOnly(index: number, row: DraftRow): void {
    if (row.valueOnly) updateRow(index, { valueOnly: false, left: "", operator: "eq" });
    else updateRow(index, { valueOnly: true, left: undefined, operator: undefined, aggregate: undefined });
  }

  function setMode(mode: ConditionMode): void {
    patch({
      mode,
      expression:
        mode === "advanced" && !draft.expression
          ? draft.rows.map((_, index) => index + 1).join(" and ")
          : draft.expression,
    });
  }

  function cleanRows(rows: DraftRow[]): ConditionRow[] {
    return rows
      .filter((row) =>
        row.valueOnly ? String(row.value ?? "").trim() !== "" : Boolean(row.left && row.operator),
      )
      .map((row) => {
        if (row.valueOnly) return { value: row.value };
        const out: ConditionRow = { left: row.left, operator: row.operator };
        if (row.aggregate && requiresAggregate(row.left)) out.aggregate = row.aggregate;
        if (!isUnary(row.operator)) out.value = row.value;
        return out;
      });
  }

  function save(): void {
    if (expressionError) {
      notify(expressionError, "error");
      return;
    }
    const node = findLocation(state.page.children ?? [], target.nodeId)?.node;
    const next: VisibilityConfig = { ...(node?.visibility ?? {}) };
    const rows = cleanRows(draft.rows);
    if (!rows.length) delete next[target.kind];
    else {
      next[target.kind] = {
        mode: draft.mode,
        rows,
        ...(draft.mode === "advanced" && draft.expression
          ? { expression: draft.expression.trim() }
          : {}),
      };
    }
    store.setVisibility(Object.keys(next).length ? next : undefined);
    onClose();
    notify("显示隐藏条件已更新", "success");
  }

  return (
    <ModalShell
      title={target.kind === "hide" ? "配置隐藏条件" : "配置显示条件"}
      width="680px"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="cond__clear"
            onClick={() => setDraft({ mode: "and", rows: [blankRow()], expression: "" })}
          >
            清空
          </button>
          <span className="cond__spacer" />
          <button type="button" className="cond__cancel" onClick={onClose}>
            取消
          </button>
          <button type="button" className="cond__ok" onClick={save}>
            确定
          </button>
        </>
      }
    >
      <div className="cond__hint">
        命中「显示」条件时一定显示（优先于隐藏）；否则命中「隐藏」条件时隐藏。
        <br />
        {scopeTip}
      </div>

      <div className="cond__section">条件间关系</div>
      <div className="cond__modes">
        {CONDITION_MODE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`cond__mode${draft.mode === option.value ? " is-active" : ""}`}
            onClick={() => setMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {draft.mode === "advanced" ? (
        <div className="cond__advanced">
          <input
            className="cond__expression wb-mono"
            type="text"
            spellCheck={false}
            placeholder="1 and (2 or 3)"
            value={draft.expression}
            onChange={(event) => patch({ expression: event.target.value })}
          />
          <div className={`cond__tip${expressionError ? " is-error" : ""}`}>
            {expressionError || "用条件序号组合，支持 and / or / not 与括号，序号从 1 开始。"}
          </div>
        </div>
      ) : null}

      <div className="cond__section">条件列表</div>
      <div className="cond__rows wb-scroll">
        {draft.rows.map((row, index) => (
          <div className="cond__row" key={index}>
            <span className="cond__no">{index + 1}</span>

            {!row.valueOnly ? (
              <>
                <select
                  className="cond__select cond__left"
                  aria-label="左元素"
                  value={row.left ?? ""}
                  onChange={(event) => updateRow(index, { left: event.target.value })}
                >
                  <option value="">选择元素</option>
                  {elements.map((element) => (
                    <option key={element.nodeId} value={element.path}>
                      {element.label}（{element.path}）
                    </option>
                  ))}
                </select>

                {requiresAggregate(row.left) ? (
                  <select
                    className="cond__select cond__aggregate"
                    aria-label="聚合口径"
                    value={row.aggregate ?? "sum"}
                    onChange={(event) =>
                      updateRow(index, { aggregate: event.target.value as DraftRow["aggregate"] })
                    }
                  >
                    {CONDITION_AGGREGATES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                <select
                  className="cond__select cond__operator"
                  aria-label="关系"
                  value={row.operator ?? "eq"}
                  onChange={(event) =>
                    updateRow(index, { operator: event.target.value as ConditionRow["operator"] })
                  }
                >
                  {CONDITION_OPERATOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {!isUnary(row.operator) ? (
                  <input
                    className="cond__value"
                    type="text"
                    placeholder="值，或 {{路径}}"
                    value={String(row.value ?? "")}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                  />
                ) : (
                  <span className="cond__value-placeholder">—</span>
                )}
              </>
            ) : (
              <input
                className="cond__value cond__value--only"
                type="text"
                placeholder="仅值：表达式或字面量，如 {{form.amount}} > 10"
                value={String(row.value ?? "")}
                onChange={(event) => updateRow(index, { value: event.target.value })}
              />
            )}

            <label className="cond__only" title="特殊场景：只填值，不设左元素与关系">
              <input
                type="checkbox"
                checked={Boolean(row.valueOnly)}
                onChange={() => toggleValueOnly(index, row)}
              />
              仅值
            </label>
            <button
              type="button"
              className="cond__del"
              aria-label="删除条件"
              onClick={() => patch({ rows: draft.rows.filter((_, i) => i !== index) })}
            >
              ×
            </button>
          </div>
        ))}
        {!draft.rows.length ? <div className="cond__empty">还没有条件，点击「添加条件」开始</div> : null}
      </div>

      <button type="button" className="cond__add" onClick={() => patch({ rows: [...draft.rows, blankRow()] })}>
        ＋ 添加条件
      </button>
    </ModalShell>
  );
}
