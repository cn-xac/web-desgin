/**
 * 页面仓储（原型阶段的本地实现）。
 * 接口形状刻意对齐后端三表模型：list / get / save / remove / duplicate。
 * 接真后端时只替换这一层，设计器与渲染器无需改动。
 */

import type { PageSchema } from "@x-ac/design-core";
import type { PageRepository } from "@x-ac/design-vue/designer";
import { compactPage } from "@x-ac/design-core";
import { createRegistry } from "@x-ac/design-core";
import { migratePage } from "@x-ac/design-core";
import { validatePage } from "@x-ac/design-core";
import { employeeOnboardTemplate, ticketTemplate } from "@/data/templates";
import { playgroundAdapter } from "../materials";

const STORAGE_KEY = "vue-design:pages:v1";

/**
 * 校验用的组件集合必须取「当前适配包 + 业务物料」这一份，
 * 而不是 core 的默认清单 —— 否则业务物料在每次保存时都会被当成未注册组件告警。
 */
const KNOWN_COMPONENTS = createRegistry(playgroundAdapter.materials).knownComponents();

export interface PageRecord {
  id: string;
  title: string;
  schema: PageSchema;
  createdAt: number;
  updatedAt: number;
}

function safeParse(raw: string | null): PageRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((item) => item && typeof item === "object" && item.schema);
  } catch {
    return [];
  }
}

function readAll(): PageRecord[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeAll(records: PageRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listPages(): PageRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPage(id: string): PageRecord | null {
  return readAll().find((item) => item.id === id) ?? null;
}

export function savePage(page: PageSchema): PageRecord {
  const compact = compactPage(page);
  const result = validatePage(compact, KNOWN_COMPONENTS);
  if (!result.valid) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("；"));
  }

  const records = readAll();
  const index = records.findIndex((item) => item.id === compact.id);
  const now = Date.now();
  const title = String(compact.meta?.title ?? "未命名页面");

  const record: PageRecord =
    index >= 0
      ? { ...records[index], title, schema: compact, updatedAt: now }
      : { id: compact.id, title, schema: compact, createdAt: now, updatedAt: now };

  if (index >= 0) records[index] = record;
  else records.push(record);

  writeAll(records);
  return record;
}

export function createPage(page: PageSchema): PageRecord {
  return savePage(page);
}

export function removePage(id: string): void {
  writeAll(readAll().filter((item) => item.id !== id));
}

export function duplicatePage(id: string): PageRecord | null {
  const source = getPage(id);
  if (!source) return null;
  const copy = JSON.parse(JSON.stringify(source.schema)) as PageSchema;
  copy.id = `page_${Math.random().toString(36).slice(2, 10)}`;
  copy.meta = { ...(copy.meta ?? {}), title: `${source.title} 副本` };
  return savePage(copy);
}

export function renamePage(id: string, title: string): PageRecord | null {
  const record = getPage(id);
  if (!record) return null;
  const schema = { ...record.schema, meta: { ...(record.schema.meta ?? {}), title } };
  return savePage(schema);
}

/** 首次进入时灌入两个可直接体验的模板（只灌一次，用户删空后不再打扰） */
export function ensureSeed(): void {
  if (typeof localStorage === "undefined") return;
  const seededKey = `${STORAGE_KEY}:seeded`;
  if (localStorage.getItem(seededKey)) return;
  try {
    if (readAll().length === 0) {
      savePage(employeeOnboardTemplate());
      savePage(ticketTemplate());
    }
    localStorage.setItem(seededKey, "1");
  } catch (error) {
    console.warn("[vue-design] 模板初始化失败", error);
  }
}

/** 导入：接受 JSON 文本，执行迁移 + 校验 + 换新 id 落库 */
export function importPage(raw: string, options: { keepId?: boolean } = {}): PageRecord {
  const { schema, applied } = migratePage(raw);
  if (applied.length) console.info("[vue-design] 已执行迁移", applied);

  if (!options.keepId) {
    schema.id = `page_${Math.random().toString(36).slice(2, 10)}`;
  }

  const result = validatePage(schema, KNOWN_COMPONENTS);
  if (!result.valid) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("；"));
  }
  return savePage(schema);
}

/**
 * 交给设计器的仓储实现。
 * 设计器只认 PageRepository 契约，换成 HTTP 接口时替换这里即可。
 */
export const localStorageRepo: PageRepository = {
  list: () => listPages(),
  get: (id) => getPage(id) ?? undefined,
  save: (schema) => savePage(schema),
  remove: (id) => removePage(id),
};
