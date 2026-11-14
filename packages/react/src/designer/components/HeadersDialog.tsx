/**
 * 请求头设置弹窗（对齐 Vue 的 HeadersDialog.vue）。
 *
 * 请求头是「另一类」配置：条目多、几乎不改、改错了很难一眼看出来。
 * 塞进外部数据源主弹窗会把主弹窗撑成一坨，所以单独拆一个弹窗。
 *
 * 行以数组形式保存：空名称的行在编辑期间必须留着，
 * 否则用户刚添加的那一行会被下一次编辑挤掉；空行在「确定」时才由调用方过滤。
 */
import { useState } from "react";
import type { HeaderRow } from "../dialogs";
import { ModalShell } from "./ModalShell";

export interface HeadersDialogProps {
  initial: HeaderRow[];
  onCancel: () => void;
  onConfirm: (rows: HeaderRow[]) => void;
}

export function HeadersDialog({ initial, onCancel, onConfirm }: HeadersDialogProps) {
  const [rows, setRows] = useState<HeaderRow[]>(() => initial.map((row) => ({ ...row })));

  const add = (): void => setRows((current) => [...current, { key: "", value: "" }]);

  const remove = (index: number): void =>
    setRows((current) => current.filter((_, i) => i !== index));

  const patch = (index: number, partial: Partial<HeaderRow>): void =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...partial } : row)));

  return (
    <ModalShell
      title="请求头"
      width="460px"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="hdr__cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="hdr__ok" onClick={() => onConfirm(rows)}>
            确定
          </button>
        </>
      }
    >
      <div className="hdr__hint">逐条填写请求头名称与取值，名称不能为空。</div>

      <div className="hdr__rows">
        {rows.map((row, index) => (
          <div className="hdr__row" key={index}>
            <input
              className="hdr__input wb-mono"
              value={row.key}
              placeholder="名称，如 Authorization"
              spellCheck={false}
              onChange={(event) => patch(index, { key: event.target.value })}
            />
            <input
              className="hdr__input wb-mono"
              value={row.value}
              placeholder="取值"
              spellCheck={false}
              onChange={(event) => patch(index, { value: event.target.value })}
            />
            <button type="button" className="hdr__del" title="删除" onClick={() => remove(index)}>
              ×
            </button>
          </div>
        ))}
        {!rows.length ? <div className="hdr__empty">还没有请求头</div> : null}
      </div>

      <button type="button" className="hdr__add" onClick={add}>
        + 添加请求头
      </button>
    </ModalShell>
  );
}
