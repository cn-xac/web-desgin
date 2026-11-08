import { useEffect, useState, type DragEvent } from "react";
import { getBreadcrumb, type DropPosition, type NodeSchema } from "@x-ac/design-core";
import { useDesigner } from "../context";

interface OutlineTreeProps {
  nodes: NodeSchema[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

/** 递归组件树：与画布双向选中、悬停高亮、拖拽调层级、行内复制删除 */
function OutlineTree({ nodes, depth, expanded, onToggle }: OutlineTreeProps) {
  const { store, state, registry } = useDesigner();

  const labelOf = (node: NodeSchema): string => {
    const material = registry.get(node.component);
    const textProp = material?.textProp;
    const summary = textProp ? String(node.props?.[textProp] ?? "").trim() : "";
    const suffix = summary ? ` · ${summary.slice(0, 12)}` : "";
    return `${material?.title ?? node.component}${suffix}`;
  };

  const hintFor = (node: NodeSchema): DropPosition | null => {
    const hint = state.dropHint;
    if (!hint || hint.id !== node.id) return null;
    return hint.position;
  };

  /** 与画布同一套阈值：容器上下 1/4 为 before/after，中间 inside */
  const positionFromEvent = (event: DragEvent<HTMLElement>, node: NodeSchema): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (registry.get(node.component)?.acceptsChildren) {
      if (ratio < 0.25) return "before";
      if (ratio > 0.75) return "after";
      return "inside";
    }
    return ratio < 0.5 ? "before" : "after";
  };

  const selectRow = (node: NodeSchema): void => {
    store.select(node.id);
    // jsdom / 非浏览器宿主没有 scrollIntoView，滚动只是增强体验，不能让选中流程崩掉
    const target = document.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
    target?.scrollIntoView?.({ block: "center" });
  };

  const copyRow = (node: NodeSchema): void => {
    store.select(node.id);
    store.duplicateSelected();
  };

  const removeRow = (node: NodeSchema): void => {
    store.select(node.id);
    store.removeSelected();
  };

  const onDragStart = (event: DragEvent<HTMLElement>, node: NodeSchema): void => {
    event.stopPropagation();
    event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "move", id: node.id }));
    event.dataTransfer.effectAllowed = "move";
    store.beginDrag({ kind: "move", id: node.id });
  };

  const onDragOver = (event: DragEvent<HTMLElement>, node: NodeSchema): void => {
    event.preventDefault();
    event.stopPropagation();
    store.setDropHint({ id: node.id, position: positionFromEvent(event, node) });
  };

  const onDragLeave = (node: NodeSchema): void => {
    if (state.dropHint?.id === node.id) store.setDropHint(null);
  };

  const onDrop = (event: DragEvent<HTMLElement>, node: NodeSchema): void => {
    event.preventDefault();
    event.stopPropagation();
    const hint = { id: node.id, position: positionFromEvent(event, node) };
    store.applyDrop(hint);
  };

  return (
    <ul className={`otree${depth === 0 ? " otree--root" : ""}`}>
      {nodes.map((node) => {
        const children = node.children ?? [];
        const kids = children.length > 0;
        const hint = hintFor(node);
        const label = labelOf(node);
        const rowClass = [
          "otree__row",
          state.selectedId === node.id ? "is-sel" : "",
          hint === "before" ? "is-hint-before" : "",
          hint === "after" ? "is-hint-after" : "",
          hint === "inside" ? "is-hint-inside" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={node.id} className="otree__item">
            <div
              className={rowClass}
              data-outline-id={node.id}
              style={{ paddingLeft: 6 + depth * 14 }}
              draggable
              onClick={() => selectRow(node)}
              onMouseEnter={() => store.hover(node.id)}
              onMouseLeave={() => store.hover(null)}
              onDragStart={(event) => onDragStart(event, node)}
              onDragOver={(event) => onDragOver(event, node)}
              onDragLeave={() => onDragLeave(node)}
              onDrop={(event) => onDrop(event, node)}
              onDragEnd={() => store.clearDrag()}
            >
              <span
                className={`otree__arrow${kids ? "" : " is-leaf"}`}
                title={kids ? "展开 / 收起" : ""}
                onClick={(event) => {
                  event.stopPropagation();
                  if (kids) onToggle(node.id);
                }}
              >
                {kids ? (expanded.has(node.id) ? "▾" : "▸") : ""}
              </span>
              <span className="otree__icon">{registry.get(node.component)?.icon ?? "?"}</span>
              <span className="otree__name" title={label}>
                {label}
              </span>
              {kids ? <span className="otree__count">{children.length}</span> : null}
              <span className="otree__acts">
                <button
                  type="button"
                  className="otree__act"
                  title="复制"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyRow(node);
                  }}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="otree__act"
                  title="删除"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeRow(node);
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
            {kids && expanded.has(node.id) ? (
              <OutlineTree
                nodes={children}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 组件树面板：头部计数、根节点接收「放到最外层」的拖放 */
export function OutlinePanel() {
  const { store, state } = useDesigner();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const roots = state.page.children ?? [];

  /** 画布选中深处节点时自动展开祖先，并把对应行滚到可视区 */
  useEffect(() => {
    const id = state.selectedId;
    if (!id) return;
    const trail = getBreadcrumb(roots, id);
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const node of trail) {
        if (node.id !== id && !next.has(node.id)) {
          next.add(node.id);
          changed = true;
        }
      }
      const leaf = trail[trail.length - 1];
      if (leaf?.children?.length && !next.has(leaf.id)) {
        next.add(leaf.id);
        changed = true;
      }
      return changed ? next : prev;
    });
    const row = document.querySelector<HTMLElement>(`[data-outline-id="${id}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }, [state.selectedId, roots]);

  const onToggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootHint = state.dragPayload !== null && state.dropHint?.id === null;

  const onRootDragOver = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    store.setDropHint({ id: null, position: "inside" });
  };

  const onRootDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    store.applyDrop({ id: null, position: "inside" });
  };

  return (
    <aside className="opanel">
      <div className="opanel__head">
        <span>组件树</span>
        <span className="opanel__count">{state.nodeCount}</span>
      </div>

      <div className="opanel__scroll wb-scroll">
        <div
          className={`opanel__root${rootHint ? " is-hint-inside" : ""}`}
          title="页面根：拖到这里放到最外层"
          onClick={() => store.select(null)}
          onDragOver={onRootDragOver}
          onDragLeave={() => store.setDropHint(null)}
          onDrop={onRootDrop}
        >
          <span className="opanel__root-icon">📄</span>
          <span className="opanel__root-name">页面</span>
        </div>

        {roots.length ? (
          <OutlineTree nodes={roots} depth={0} expanded={expanded} onToggle={onToggle} />
        ) : (
          <div className="opanel__empty">画布还是空的，从左侧拖入或点击组件</div>
        )}
      </div>

      <div className="opanel__foot">点击选中 · 悬停高亮 · 拖拽调整层级</div>
    </aside>
  );
}
