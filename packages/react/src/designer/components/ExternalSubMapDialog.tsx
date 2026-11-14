/**
 * 子映射弹窗（对齐 Vue 的 ExternalSubMapDialog.vue）。
 *
 * 响应目标是子表单时，主映射里给出「父字段名」（明细数组所在的字段），
 * 子映射只需要填「父字段里的子字段」：
 * - 左侧是子表单里已经有的字段（只读，来自 Schema）；
 * - 右侧填这一项在响应数据里对应的字段名，留空表示不映射。
 *
 * 运行时，响应数组的每一行都会按这些映射填成一条明细对象。
 */
import { useState } from "react";
import { collectSubFormFields } from "@x-ac/web-design-core";
import type { ExternalSubMap } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import type { SubMapTarget } from "../dialogs";
import { HelpTip } from "./HelpTip";
import { ModalShell } from "./ModalShell";

/** 问号图标上的悬浮说明 */
const SUB_MAP_TIP = [
  "子映射：响应数组的每一行会填成子表单的一条明细。",
  "左侧是子表单里已有的字段（只读），右侧填这一项在响应数据里对应的字段名，留空表示不映射。",
  "父字段名已在主映射里设置，这里只填它的子字段。",
].join("\n");

export interface ExternalSubMapDialogProps {
  target: SubMapTarget;
  onCancel: () => void;
  onConfirm: (maps: ExternalSubMap[]) => void;
}

interface Row {
  field: string;
  label: string;
  from: string;
}

export function ExternalSubMapDialog({ target, onCancel, onConfirm }: ExternalSubMapDialogProps) {
  const { state, registry } = useDesigner();
  const fields = collectSubFormFields(state.page, target.groupNodeId, { registry });

  const [rows, setRows] = useState<Row[]>(() => {
    const previous = new Map(target.maps.map((item) => [item.field, item.from]));
    return fields.map((item) => ({
      field: item.field,
      label: item.label,
      from: previous.get(item.field) ?? "",
    }));
  });

  const patch = (index: number, from: string): void =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, from } : row)));

  const save = (): void =>
    onConfirm(
      rows
        .filter((row) => row.from.trim())
        .map((row) => ({ field: row.field, from: row.from.trim() })),
    );

  return (
    <ModalShell
      title={`子映射 · ${target.label}`}
      width="560px"
      onClose={onCancel}
      footer={
        <>
          <span className="sub__spacer" />
          <button type="button" className="sub__cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="sub__ok" onClick={save}>
            确定
          </button>
        </>
      }
    >
      <div className="sub">
        {/* 说明项：让人一眼看懂怎么填 */}
        <div className="sub__tip">
          <HelpTip text={SUB_MAP_TIP} />
          <div className="sub__tip-body">
            <b>子映射</b>：响应数组的<b>每一行</b>会填成子表单的一条明细。
            <br />
            左侧是子表单里已有的字段，右侧填这一项在响应数据里对应的<b>字段名</b>（留空 = 不映射）。
            <br />
            父字段名 <code>{target.parentField}</code> 已在主映射里设置，这里只填它的子字段。
          </div>
        </div>

        <div className="sub__head">
          <span className="sub__col sub__col--field">子表单字段</span>
          <span className="sub__col sub__col--from">响应数据字段</span>
        </div>

        <div className="sub__rows">
          {rows.map((row, index) => (
            <div className="sub__row" key={row.field}>
              <div className="sub__col sub__col--field">
                <span className="sub__label">{row.label}</span>
                <code className="sub__code">{row.field}</code>
              </div>
              <input
                className="sub__input wb-mono"
                value={row.from}
                placeholder="如 goodsName（留空 = 不映射）"
                spellCheck={false}
                onChange={(event) => patch(index, event.target.value)}
              />
            </div>
          ))}
          {!rows.length ? (
            <div className="sub__empty">该子表单里还没有可映射的字段，先在子表单内添加表单控件。</div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
