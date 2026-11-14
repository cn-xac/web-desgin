/**
 * 可绑定数据选择器（对齐 Vue 的 BindingPicker.vue）。
 *
 * 列出当前页面**能绑**的数据，点一条即完成绑定。清单由 core 的
 * collectBindableData 从页面 Schema 生成，与运行时的绑定规则严格对齐
 * （显式 modelValue > form.<节点ID> > 页面状态 / 数据源键）。
 *
 * 弹窗只负责「选」与「写」，不关心被绑的是哪个组件 —— 落点由 dialogs 的 target 决定。
 */
import { useState } from "react";
import {
  collectBindableData,
  filterBindableData,
  findLocation,
  groupBindableData,
} from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import type { BindingTarget } from "../dialogs";
import { ModalShell } from "./ModalShell";

export interface BindingPickerDialogProps {
  target: BindingTarget;
  onClose: () => void;
}

export function BindingPickerDialog({ target, onClose }: BindingPickerDialogProps) {
  const { store, state, registry } = useDesigner();
  const [keyword, setKeyword] = useState("");

  // 清单随页面变化实时重算：设计期一直在改 Schema，缓存会立刻过期
  const grouped = groupBindableData(filterBindableData(collectBindableData(state.page, { registry }), keyword));

  /** 当前属性已绑定的路径（用于高亮 + 清除） */
  const node = findLocation(state.page.children ?? [], target.nodeId)?.node;
  const raw = target.where === "props" ? node?.props?.[target.key] : node?.style?.[target.key];
  const match = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(String(raw ?? ""));
  const currentPath = match ? match[1] : "";

  const pick = (path: string): void => {
    if (target.where === "props") store.updateProp(target.key, `{{${path}}}`);
    else store.updateStyle(target.key, `{{${path}}}`);
    onClose();
  };

  /** 清除绑定：props 删键回落默认值，style 删键回落默认样式 */
  const unbind = (): void => {
    if (target.where === "props") store.updateProp(target.key, undefined);
    else store.updateStyle(target.key, "");
    onClose();
  };

  return (
    <ModalShell
      title="选择可绑定数据"
      width="560px"
      onClose={onClose}
      footer={
        <>
          {currentPath ? (
            <button type="button" className="picker__unbind" onClick={unbind}>
              清除绑定（{currentPath}）
            </button>
          ) : null}
          <span className="picker__spacer" />
          <button type="button" className="picker__cancel" onClick={onClose}>
            取消
          </button>
        </>
      }
    >
      <div className="picker">
        <input
          className="picker__search"
          type="search"
          value={keyword}
          placeholder="搜索名称或路径，如 姓名 / form.name"
          spellCheck={false}
          onChange={(event) => setKeyword(event.target.value)}
        />

        {!grouped.length ? (
          <div className="picker__empty">
            当前页面还没有可绑定的数据。可先在「页面设置」里加页面状态，或给某个表单控件设值。
          </div>
        ) : (
          <div className="picker__list wb-scroll">
            {grouped.map((group) => (
              <section className="picker__group" key={group.group}>
                <div className="picker__group-name">
                  {group.group}（{group.items.length}）
                </div>
                {group.items.map((item) => (
                  <button
                    type="button"
                    key={item.path}
                    className={`picker__item${item.path === currentPath ? " is-active" : ""}`}
                    onClick={() => pick(item.path)}
                  >
                    <span className="picker__item-label">{item.label}</span>
                    <span className="picker__item-path">{item.path}</span>
                    {item.hint ? <span className="picker__item-hint">{item.hint}</span> : null}
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
