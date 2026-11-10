import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PageSchema } from "@x-ac/web-design-core";
import { deepClone, loadPageData, setByPath } from "@x-ac/web-design-core";

export interface PageStore {
  scope: Record<string, unknown>;
  errors: Record<string, string>;
  /** 每次 scope / errors 变化自增：供宿主的 useEffect 监听（对齐 Vue 的 deep watch） */
  version: number;
  loading: boolean;
  dataError: string;
  setValue: (path: string, value: unknown, nodeId?: string) => void;
  setError: (nodeId: string, message: string) => void;
  /** 写入或清除单个字段错误（传 null 表示已修好） */
  patchError: (nodeId: string, message: string | null) => void;
  setErrors: (next: Record<string, string>) => void;
  /** 强制重渲染：core 的动作会就地修改 errors / scope，需要宿主主动刷新 */
  flush: () => void;
  resetScope: (paths?: string[]) => void;
  /** 外部数据整体替换（对齐 Vue 的 v-model:data 宿主 → scope 通道） */
  replaceScope: (next: Record<string, unknown>) => void;
  /** 重新执行 dataSource 取数 */
  reload: () => void;
}

/**
 * React 版的页面状态，与 Vue 的 usePageScope 共用 core 的 loadPageData。
 * core 的 setByPath 直接改对象、不感知响应式，所以这里用 version 计数强制重渲染。
 */
export function usePageStore(page: PageSchema, seed?: Record<string, unknown>): PageStore {
  const initial = useRef<Record<string, unknown>>(
    deepClone(seed && Object.keys(seed).length ? seed : page.state ?? {}),
  );
  const scopeRef = useRef<Record<string, unknown>>(deepClone(initial.current));
  const [version, force] = useReducer((x: number) => x + 1, 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // load 的回调需要读到最新 page，但不应因 page 引用变化而反复重建
  const pageRef = useRef(page);
  pageRef.current = page;

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    // 没配数据源时不要触发无谓的重渲染
    if (!Object.keys(pageRef.current.dataSource ?? {}).length) return Promise.resolve();
    return loadPageData(pageRef.current, scopeRef.current, {
      signal,
      onLoading: setLoading,
      onError: setDataError,
    }).then(() => force());
  }, []);

  const stateKey = JSON.stringify(page.state ?? {});

  useEffect(() => {
    initial.current = deepClone(page.state ?? {});
    scopeRef.current = deepClone(initial.current);
    setErrors({});
    const controller = new AbortController();
    void load(controller.signal);
    force();
    return () => controller.abort();
  }, [page.id, stateKey, load]);

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

  const resetScope = useCallback(
    (paths?: string[]) => {
      if (paths?.length) {
        paths.forEach((path) =>
          setByPath(scopeRef.current, path, (initial.current as Record<string, unknown>)[path]),
        );
      } else {
        scopeRef.current = deepClone(initial.current);
        setErrors({});
        void load();
      }
      force();
    },
    [load],
  );

  const replaceScope = useCallback((next: Record<string, unknown>) => {
    initial.current = deepClone(next);
    scopeRef.current = deepClone(next);
    setErrors({});
    force();
  }, []);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return {
    scope: scopeRef.current,
    errors,
    version,
    loading,
    dataError,
    setValue,
    setError,
    patchError,
    setErrors,
    flush: force,
    resetScope,
    replaceScope,
    reload,
  };
}
