import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PageSchema } from "@x-ac/design-core";
import { deepClone, setByPath } from "@x-ac/design-core";

export interface PageStore {
  scope: Record<string, unknown>;
  errors: Record<string, string>;
  setValue: (path: string, value: unknown, nodeId?: string) => void;
  setError: (nodeId: string, message: string) => void;
  /** 写入或清除单个字段错误（传 null 表示已修好） */
  patchError: (nodeId: string, message: string | null) => void;
  setErrors: (next: Record<string, string>) => void;
  /** 强制重渲染：core 的动作会就地修改 errors / scope，需要宿主主动刷新 */
  flush: () => void;
  resetScope: (paths?: string[]) => void;
}

/**
 * React 版的页面状态。
 * core 的 setByPath 直接改对象，不感知响应式，所以这里用 version 计数强制重渲染。
 */
export function usePageStore(page: PageSchema): PageStore {
  const initial = useRef<Record<string, unknown>>(deepClone(page.state ?? {}));
  const scopeRef = useRef<Record<string, unknown>>(deepClone(initial.current));
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    initial.current = deepClone(page.state ?? {});
    scopeRef.current = deepClone(initial.current);
    setErrors({});
    force();
  }, [page.id]);

  const setValue = useCallback((path: string, value: unknown, nodeId?: string) => {
    setByPath(scopeRef.current, path, value);
    if (nodeId) {
      setErrors((prev) => {
        if (!prev[nodeId]) return prev;
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
    }
    force();
  }, []);

  const setError = useCallback((nodeId: string, message: string) => {
    setErrors((prev) => ({ ...prev, [nodeId]: message }));
    force();
  }, []);

  const patchError = useCallback((nodeId: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null) {
        if (!(nodeId in prev)) return prev;
        const next = { ...prev };
        delete next[nodeId];
        return next;
      }
      if (prev[nodeId] === message) return prev;
      return { ...prev, [nodeId]: message };
    });
  }, []);

  const resetScope = useCallback((paths?: string[]) => {
    if (paths?.length) {
      paths.forEach((path) => setByPath(scopeRef.current, path, (initial.current as Record<string, unknown>)[path]));
    } else {
      scopeRef.current = deepClone(initial.current);
      setErrors({});
    }
    force();
  }, []);

  return {
    scope: scopeRef.current,
    errors,
    setValue,
    setError,
    patchError,
    setErrors,
    flush: force,
    resetScope,
  };
}
