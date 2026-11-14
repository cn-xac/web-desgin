/**
 * 说明提示（问号图标 + 悬浮说明）—— 对齐 Vue 的 HelpTip.vue / NativeTooltip。
 *
 * 浮层跟随宿主 UI 库：适配包提供 `designer.Tooltip` 时用它的实现，
 * 缺省回落引擎自带的原生实现（零 UI 库依赖）。
 *
 * 契约见 core 的 `DesignerKit.Tooltip`：接受 `text`（说明文案）+ children（触发元素）。
 * 各家 API 不同（Element Plus 是 content、antd 是 title），差异由适配包层包装组件消化。
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDesigner } from "../context";

/** 弹层宽度（与 CSS 的 .wbd-tip__pop 保持一致） */
const POP_WIDTH = 264;
/** 预估弹层高度：用于判断下方是否放得下，放不下就翻到上方 */
const ESTIMATED_HEIGHT = 140;
const GAP = 8;

interface Position {
  top: number | null;
  bottom: number | null;
  left: number;
}

export interface NativeTooltipProps {
  text: string;
  children?: ReactNode;
}

/**
 * 原生浮层：Teleport 到 body（React 用 createPortal）→ fixed 定位，
 * 不受弹窗 / 面板的 overflow 裁剪；滚动与缩放时重新定位。
 */
export function NativeTooltip({ text, children }: NativeTooltipProps) {
  const host = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, bottom: null, left: 0 });

  const place = useCallback((): void => {
    const element = host.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POP_WIDTH - 8));
    const below = rect.bottom + GAP;
    const fitsBelow = below + ESTIMATED_HEIGHT <= window.innerHeight;
    setPos(
      fitsBelow
        ? { top: below, bottom: null, left }
        : { top: null, bottom: Math.max(8, window.innerHeight - rect.top + GAP), left },
    );
  }, []);

  const show = useCallback((): void => {
    place();
    setVisible(true);
  }, [place]);

  /** 指针只是从问号移到插槽内不隐藏（relatedTarget 仍在包裹盒里就保持） */
  const onOut = useCallback((event: ReactMouseEvent<HTMLSpanElement>): void => {
    const to = event.relatedTarget as Node | null;
    if (to && host.current?.contains(to)) return;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reposition = (): void => place();
    // capture 阶段才能收到内部滚动容器的 scroll 事件
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [place, visible]);

  return (
    <span
      ref={host}
      className="wbd-tip"
      // 用 mouseover / mouseout（会冒泡）而非 mouseenter：触发点在插槽里也能生效
      onMouseOver={show}
      onMouseOut={onOut}
    >
      {children}
      {visible && typeof document !== "undefined"
        ? createPortal(
            <div
              className="wbd-tip__pop"
              style={{
                top: pos.top === null ? "auto" : `${pos.top}px`,
                bottom: pos.bottom === null ? "auto" : `${pos.bottom}px`,
                left: `${pos.left}px`,
              }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

/** 问号按钮 + 说明浮层：问号图标是引擎提供的，浮层由实现方负责 */
export function HelpTip({ text }: { text: string }) {
  const { adapter } = useDesigner();
  const impl = (adapter?.designer as { Tooltip?: ComponentType<{ text: string; children?: ReactNode }> } | undefined)
    ?.Tooltip;

  const trigger = (
    <button
      type="button"
      className="wbd-tip__trigger"
      aria-label={text}
      onClick={(event) => event.stopPropagation()}
    >
      ?
    </button>
  );

  if (impl) return createElement(impl, { text }, trigger);
  return <NativeTooltip text={text}>{trigger}</NativeTooltip>;
}
