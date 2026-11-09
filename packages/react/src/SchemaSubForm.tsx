import { Fragment, useEffect, useContext, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ensureArray,
  getByPath,
  moveArrayItem,
  pushArrayItem,
  removeArrayItem,
} from "@x-ac/design-core";
import type { NodeSchema } from "@x-ac/design-core";
import { RenderContext, BINDING_BASE, useRenderContext } from "./context";
import { SchemaNode } from "./SchemaNode";

/**
 * 子表单（明细数组容器）。
 *
 * - 数据呈数组：`form.<itemPath>` = [{...}, {...}]，itemPath 相对父级绑定前缀；
 * - 可「添加 / 删除 / 上移 / 下移」每组，满足明细类数据提交（订单项、家庭成员等）；
 * - 组内字段按「当前组路径.组件ID」自动绑定，因此天然支持子表单无限嵌套；
 * - 设计态只渲染一个本地预览组，增删仅调整本地预览组数，不污染真实数据。
 *
 * 与 Vue 版 SchemaSubForm 对齐：引擎按 kind 结构渲染，无需 UI 库组件实现。
 */
export function SchemaSubForm({ node }: { node: NodeSchema }) {
  const ctx = useRenderContext();
  const design = ctx.design;
  const parentBase = useContext(BINDING_BASE);

  const effective = ctx.catalog.defaults(node.component, node.props);
  const itemPath = String(effective.itemPath ?? "items");
  const fullPath = itemPath ? `${parentBase}.${itemPath}` : parentBase;
  const minItems = Number(effective.minItems ?? 0);
  const maxItems = Number(effective.maxItems ?? 0);
  const addText = String(effective.addText ?? "添加一项");
  const title = String(effective.label ?? "明细");

  /** 设计态用一个本地预览组数，避免改动真实数据数组 */
  const [designCount, setDesignCount] = useState(1);

  const groups = (() => {
    if (design) {
      const n = Math.max(1, designCount);
      return Array.from({ length: n }, (_, i) => ({ key: `${node.id}-g${i}`, base: `${fullPath}[${i}]` }));
    }
    const arr = (getByPath(ctx.scope, fullPath) as unknown[] | undefined) ?? [];
    return arr.map((_, i) => ({ key: `${node.id}-g${i}`, base: `${fullPath}[${i}]` }));
  })();

  /** 构造一组默认数据：优先用 defaultItem(JSON)，否则按子字段构造空值 */
  function buildDefaultItem(): Record<string, unknown> {
    const raw = effective.defaultItem;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        /* 非法 JSON 时回落到按字段构造 */
      }
    }
    const item: Record<string, unknown> = {};
    for (const child of node.children ?? []) {
      const childMaterial = ctx.catalog.get(child.component);
      if (childMaterial?.isFormControl) item[child.id] = "";
    }
    return item;
  }

  function ensureData(): unknown[] {
    const arr = ensureArray(ctx.scope, fullPath);
    const floor = design ? Math.max(1, minItems) : minItems;
    let changed = false;
    while (arr.length < floor) {
      arr.push(buildDefaultItem());
      changed = true;
    }
    if (changed) ctx.flush();
    return arr;
  }

  // 运行态首次挂载时保证数组至少达到 minItems（设计态由 designCount 驱动，不碰真实数据）
  useEffect(() => {
    if (!design) ensureData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addGroup(): void {
    if (design) {
      setDesignCount((count) => count + 1);
      return;
    }
    const arr = ensureData();
    if (maxItems > 0 && arr.length >= maxItems) return;
    pushArrayItem(ctx.scope, fullPath, buildDefaultItem());
    ctx.flush();
  }

  function removeGroup(index: number): void {
    if (design) {
      setDesignCount((count) => Math.max(1, count - 1));
      return;
    }
    const arr = (getByPath(ctx.scope, fullPath) as unknown[]) ?? [];
    if (minItems > 0 && arr.length <= minItems) return;
    removeArrayItem(ctx.scope, fullPath, index);
    ctx.flush();
  }

  function moveGroup(index: number, delta: number): void {
    if (design) return;
    moveArrayItem(ctx.scope, fullPath, index, index + delta);
    ctx.flush();
  }

  const btnStyle: CSSProperties = {
    fontSize: 12,
    lineHeight: "20px",
    padding: "0 8px",
    border: "1px solid #dcdfe6",
    borderRadius: 4,
    background: "#fff",
    color: "#1f2329",
    cursor: "pointer",
  };

  const groupNodes = (node.children ?? []).map((child) => (
    <SchemaNode key={child.id} node={child} />
  ));

  const content: ReactNode = (
    <div className="ux-subform" style={{ display: "block", margin: "8px 0", border: "1px dashed #dcdfe6", borderRadius: 8, padding: 12, background: "rgba(47,75,255,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2329" }}>{title}</span>
        {!design && maxItems > 0 ? (
          <span style={{ fontSize: 12, color: "#8a909c" }}>
            {groups.length}/{maxItems}
          </span>
        ) : null}
      </div>

      {groups.map((group, index) => (
        <div
          key={group.key}
          className="ux-subform__group"
          style={{ border: "1px solid #dcdfe6", borderRadius: 6, padding: "8px 10px", marginBottom: 10, background: "#fff" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#8a909c" }}>#{index + 1}</span>
            {!design ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  style={btnStyle}
                  disabled={minItems > 0 && groups.length <= minItems}
                  onClick={() => removeGroup(index)}
                >
                  删除
                </button>
                <button type="button" style={btnStyle} disabled={index === 0} onClick={() => moveGroup(index, -1)}>
                  上移
                </button>
                <button
                  type="button"
                  style={btnStyle}
                  disabled={index === groups.length - 1}
                  onClick={() => moveGroup(index, 1)}
                >
                  下移
                </button>
              </div>
            ) : null}
          </div>
          {/* 子表单内字段失焦校验无法唯一定位「第几组」（模板共享节点 ID），
              故对子孙表单控件跳过全局失焦校验；提交时 collectFields 会逐组下钻统一校验兜底。
              同时注入当前组 base，让组内字段按 form.<base>[i].<id> 自动绑定。 */}
          <RenderContext.Provider value={{ ...ctx, validateField: () => {} }}>
            <BINDING_BASE.Provider value={group.base}>{groupNodes}</BINDING_BASE.Provider>
          </RenderContext.Provider>
        </div>
      ))}

      <button
        type="button"
        style={{ ...btnStyle, width: "100%", borderStyle: "dashed", color: "#2f4bff" }}
        disabled={!design && maxItems > 0 && groups.length >= maxItems}
        onClick={addGroup}
      >
        + {addText}
      </button>
    </div>
  );

  return <Fragment>{content}</Fragment>;
}
