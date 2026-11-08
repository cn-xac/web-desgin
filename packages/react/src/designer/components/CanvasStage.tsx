import { useMemo, type DragEvent, type MouseEvent } from "react";
import { useDesigner } from "../context";
import { SchemaRenderer } from "../../SchemaRenderer";
import type { RendererDesignerScene } from "../../context";

/** 画布舞台：设备宽度、SchemaRenderer 设计态注入，以及空白区域的选中 / 拖放 */
export function CanvasStage(props: { navigate?: (to: string) => void }) {
  const { store, state, adapter } = useDesigner();

  const scene = useMemo<RendererDesignerScene>(
    () => ({
      selectedId: () => state.selectedId,
      hoveredId: () => state.hoverId,
      select: (id) => store.select(id),
      hoverNode: (id) => store.hover(id),
      onNodeDragStart: (id) => store.beginDrag({ kind: "move", id }),
      onNodeDragOver: (hint) => store.setDropHint(hint),
      onNodeDragLeave: () => store.setDropHint(null),
      onNodeDrop: (hint) => store.applyDrop(hint),
      hintFor: (id) => {
        const hint = state.dropHint;
        if (!hint || hint.id !== id) return null;
        return hint.position;
      },
    }),
    [store, state.selectedId, state.hoverId, state.dropHint],
  );

  const device = state.page.meta?.device ?? "pc";
  const canvasWidth = device === "h5" ? 420 : device === "pad" ? 768 : 960;
  const deviceLabel = device === "h5" ? "H5 · 420" : device === "pad" ? "Pad · 768" : "PC · 960";
  const title = state.page.meta?.title ?? "未命名页面";

  /** 多层根容器共用同一处理：仅当事件直接落在自身时才算点击空白 */
  const onBlankClick = (event: MouseEvent<HTMLElement>): void => {
    if (event.target === event.currentTarget) store.select(null);
  };

  /** 画布内节点已在 DesignerWrap 里 stopPropagation，根层只处理空白区域的拖放 */
  const onStageDragOver = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    if (state.dropHint) store.setDropHint(null);
  };

  const onStageDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    store.applyDrop({ id: null, position: "inside" });
  };

  return (
    <div
      className="stage wb-scroll"
      onClick={onBlankClick}
      onDragOver={onStageDragOver}
      onDrop={onStageDrop}
    >
      <div className="stage__inner">
        <div className="canvas" style={{ maxWidth: canvasWidth }} onClick={onBlankClick}>
          <div className="canvas__bar">
            <span className="canvas__title">{title}</span>
            <span className="canvas__badge">{deviceLabel}</span>
          </div>
          <div className="canvas__body" onClick={onBlankClick}>
            <SchemaRenderer
              page={state.page}
              mode="edit"
              design
              designer={scene}
              navigate={props.navigate}
              ui={adapter ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
