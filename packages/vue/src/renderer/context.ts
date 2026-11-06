import { inject, type InjectionKey } from "vue";
import type { NodeSchema, Material, PageSchema, UiAdapter } from "@x-ac/design-core";

/** 渲染上下文：动作执行、字段校验、跨页跳转都从这里拿 */
export interface RenderContext {
  page: PageSchema;
  /** nodeId -> 错误文案 */
  errors: Record<string, string>;
  resetScope: (paths?: string[]) => void;
  navigate: (to: string) => void;
  /** 只校验一个节点，结果同步进 errors（失焦 / 修改后调用） */
  validateField: (node: NodeSchema) => void;
  /** submitForm 动作提交成功时回调（抛给宿主的 @submit 事件） */
  onFormSubmit: (payload: Record<string, unknown>) => void;
}

export const RENDER_CONTEXT: InjectionKey<RenderContext> = Symbol("wb-render-context");

export interface DropPositionLike {
  id: string;
  position: "inside" | "before" | "after";
}

/** 设计态场景接口：渲染器只调用它，不感知具体实现，保证 view 模式可脱离设计器 */
export interface DesignerScene {
  selectedId: () => string | null;
  select: (id: string | null) => void;
  /**
   * 外部（组件树）悬停 → 画布节点高亮。可选能力：
   * 未提供时画布不响应外部悬停，view 模式完全不受影响。
   */
  hoveredId?: () => string | null;
  hoverNode?: (id: string | null) => void;
  onNodeDragStart: (id: string) => void;
  onNodeDragOver: (hint: DropPositionLike) => void;
  onNodeDragLeave: (id: string) => void;
  onNodeDrop: (hint: DropPositionLike) => void;
  hintFor: (id: string) => "inside" | "before" | "after" | null;
}

export const DESIGNER_SCENE: InjectionKey<DesignerScene> = Symbol("wb-designer-scene");

/**
 * UI 适配包：引擎只认这份契约，不认识任何具体 UI 库。
 *
 * 由宿主通过 createVueDesign({ adapter }) 或 <SchemaPage :adapter> 注入，
 * 是应用级单例 —— 页面内不支持运行时切换（切换请重建根组件）。
 */
export const UI_ADAPTER: InjectionKey<UiAdapter<unknown> | null> = Symbol("wb-ui-adapter");

/** 取当前适配包；未注入时返回 null，渲染器会降级为未知组件占位（不白屏） */
export function useUiAdapter(): UiAdapter<unknown> | null {
  return inject(UI_ADAPTER, null);
}

/** 物料查找：适配包自带 materials 时优先，否则回落到 core 的默认清单 */
export function materialFrom(adapter: UiAdapter<unknown> | null, key: string): Material | undefined {
  if (!adapter?.materials?.length) return undefined;
  return adapter.materials.find((item) => item.component === key);
}
