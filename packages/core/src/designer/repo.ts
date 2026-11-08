/**
 * 页面仓储契约（框架无关）。
 *
 * 设计器不直接依赖 localStorage / 后端接口：宿主通过 setPageRepository 注入实现，
 * 浏览器端用 localStorage、生产环境用 HTTP 接口、单测用内存实现，三者对设计器等价。
 *
 * Vue 与 React 的 designer 子入口共用这一份全局单例，避免「在 Vue 包里注入、
 * React 包里读不到」这类跨适配层的状态割裂。
 */

import type { PageSchema } from "../schema/types";

export interface PageRecord {
  id: string;
  schema: PageSchema;
  updatedAt: number;
}

export interface PageRepository {
  list: () => PageRecord[];
  get: (id: string) => PageRecord | undefined;
  save: (schema: PageSchema) => PageRecord;
  remove: (id: string) => void;
}

/** 兜底实现：不落盘，只保证设计器不会因为没注入仓储而崩溃 */
export function createMemoryRepository(seed: PageSchema[] = []): PageRepository {
  const store = new Map<string, PageRecord>();
  seed.forEach((schema) => {
    store.set(schema.id, { id: schema.id, schema, updatedAt: Date.now() });
  });

  return {
    list: () => [...store.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    get: (id) => store.get(id),
    save: (schema) => {
      const record: PageRecord = { id: schema.id, schema, updatedAt: Date.now() };
      store.set(schema.id, record);
      return record;
    },
    remove: (id) => {
      store.delete(id);
    },
  };
}

let current: PageRepository = createMemoryRepository();

export function setPageRepository(repo: PageRepository): void {
  current = repo;
}

export function getPageRepository(): PageRepository {
  return current;
}
