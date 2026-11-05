import { createContext, useContext } from "react";
import type { ActionAdapter, NodeSchema, PageSchema } from "@x-ac/design-core";

export type RenderMode = "view" | "edit";

export interface RenderContextValue {
  page: PageSchema;
  scope: Record<string, unknown>;
  errors: Record<string, string>;
  mode: RenderMode;
  adapter: ActionAdapter;
  navigate: (to: string) => void;
  resetScope: (paths?: string[]) => void;
  flush: () => void;
  /** 写入 scope 并触发重渲染；传 nodeId 会顺手清掉该字段的错误 */
  setValue: (path: string, value: unknown, nodeId?: string) => void;
  /** 只校验一个节点，结果同步进 errors（失焦时调用） */
  validateField: (node: NodeSchema) => void;
}

export const RenderContext = createContext<RenderContextValue | null>(null);

export function useRenderContext(): RenderContextValue {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error("[vue-design/react] SchemaNode 必须放在 SchemaRenderer 内部使用");
  return ctx;
}
