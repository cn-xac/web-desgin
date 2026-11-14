/**
 * 通用多条件构造器（rfD7Jv）— React 设计器内联版。
 *
 * React 设计器没有弹窗基建（见 overview.md「绑定选择用原生 select」的既有取舍），
 * 因此这里用可折叠区块承载与 Vue 弹窗等价的能力；数据模型、清单裁剪与求值
 * 全部复用 core，两侧写回的 Schema 完全一致。
 */
import { useEffect, useMemo, useState } from "react";
import {
  CONDITION_AGGREGATES,
  CONDITION_MODE_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
  collectConditionElements,
  validateAdvancedExpression,
  type ConditionGroup,
  type ConditionMode,
  type ConditionRow,
  type VisibilityConfig,
} from "@x-ac/web-design-core";
import { useDesigner } from "../context";

interface DraftRow extends ConditionRow {
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

function cleanRows(rows: DraftRow[], requiresAggregate: (left?: string) => boolean): ConditionRow[] {
  return rows
    .filter((row) =>
      row.valueOnly ? String(row.value ?? "").trim() !== "" : Boolean(row.left && row.operator),
    )
    .map((row) => {
      if (row.valueOnly) return { value: row.value };
      const unary = CONDITION_OPERATOR_OPTIONS.find((option) => option.value === row.operator)?.unary;
      const out: ConditionRow = { left: row.left, operator: row.operator };
      if (row.aggregate && requiresAggregate(row.left)) out.aggregate = row.aggregate;
      if (!unary) out.value = row.value;
      return out;
    });
}

export function ConditionBuilder({ kind }: { kind: "show" | "hide" }) {
  const { store, state, notify } = useDesigner();
  const node = state.selectedNode;
  const nodeId = node?.id ?? "";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => normalize(node?.visibility?.[kind]));

  useEffect(() => {
    setDraft(normalize(node?.visibility?.[kind]));
    // 仅在切换节点 / 条件类型时重新载入，避免编辑中被 store 快照覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, kind]);

  const elements = useMemo(
    () => collectConditionElements(state.page, { nodeId }),
    [state.page, nodeId],
  );

  const requiresAggregate = (left?: string): boolean =>
    elements.find((element) => element.path === left)?.requiresAggregate ?? false;

  const isUnary = (operator?: ConditionRow["operator"]): boolean =>
    CONDITION_OPERATOR_OPTIONS.find((option) => option.value === operator)?.unary ?? false;

  const expressionError =
    draft.mode === "advanced"
      ? validateAdvancedExpression(draft.expression ?? "", draft.rows.length) ?? ""
      : "";

  const summary = (() => {
    const group = node?.visibility?.[kind];
    if (!group?.rows.length) return "未配置";
    const mode = CONDITION_MODE_OPTIONS.find((option) => option.value === group.mode)?.label ?? group.mode;
    return `${group.rows.length} 条 · ${mode}`;
  })();

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const updateRow = (index: number, next: Partial<DraftRow>) =>
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, i) => (i === index ? { ...row, ...next } : row)),
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

  function save(): void {
    if (expressionError) {
      notify(expressionError, "error");
      return;
    }
    const next: VisibilityConfig = { ...(node?.visibility ?? {}) };
    const rows = cleanRows(draft.rows, requiresAggregate);
    if (!rows.length) delete next[kind];
    else {
      next[kind] = {
        mode: draft.mode,
        rows,
        ...(draft.mode === "advanced" && draft.expression
          ? { expression: draft.expression.trim() }
          : {}),
      };
    }
    store.setVisibility(Object.keys(next).length ? next : undefined);
    setOpen(false);
    notify("显示隐藏条件已更新", "success");
  }

  return (
    <div className="cond">
      <button type="button" className="cond__toggle" onClick={() => setOpen((value) => !value)}>
        {summary} · {open ? "收起" : "配置"}
      </button>

      {open && (
        <div className="cond__body">
          <div className="cond__tip">
            显示条件优先于隐藏条件；子表单内只能选同一子表单的元素，引用明细字段需指定聚合口径。
          </div>

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

          {draft.mode === "advanced" && (
            <div className="cond__advanced">
              <input
                className="cond__expression"
                value={draft.expression}
                spellCheck={false}
                placeholder="1 and (2 or 3)"
                onChange={(event) => patch({ expression: event.target.value })}
              />
              <div className={`cond__tip${expressionError ? " is-error" : ""}`}>
                {expressionError || "用条件序号组合，支持 and / or / not 与括号，序号从 1 开始。"}
              </div>
            </div>
          )}

          {draft.rows.map((row, index) => (
            <div className="cond__row" key={index}>
              <span className="cond__no">{index + 1}</span>
              {row.valueOnly ? (
                <input
                  className="cond__value cond__value--only"
                  value={String(row.value ?? "")}
                  placeholder="仅值：表达式或字面量"
                  onChange={(event) => updateRow(index, { value: event.target.value })}
                />
              ) : (
                <>
                  <select
                    className="cond__select cond__left"
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
                  {requiresAggregate(row.left) && (
                    <select
                      className="cond__select cond__aggregate"
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
                  )}
                  <select
                    className="cond__select cond__operator"
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
                  {!isUnary(row.operator) && (
                    <input
                      className="cond__value"
                      value={String(row.value ?? "")}
                      placeholder="值，或 {{路径}}"
                      onChange={(event) => updateRow(index, { value: event.target.value })}
                    />
                  )}
                </>
              )}
              <label className="cond__only">
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
                onClick={() =>
                  patch({ rows: draft.rows.filter((_, i) => i !== index) })
                }
              >
                ×
              </button>
            </div>
          ))}

          <div className="cond__actions">
            <button type="button" className="cond__add" onClick={() => patch({ rows: [...draft.rows, blankRow()] })}>
              ＋ 添加条件
            </button>
            <button type="button" className="cond__cancel" onClick={() => setOpen(false)}>
              取消
            </button>
            <button type="button" className="cond__ok" onClick={save}>
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
