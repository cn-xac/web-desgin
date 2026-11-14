/**
 * Schema 版本迁移。原则：只增不改；语义变更必须升版本并在这里补一条迁移函数。
 *
 * 当前只有 1.0.0，迁移为空实现；后续版本按 MIGRATIONS 顺序链式执行。
 */

import { SCHEMA_VERSION, type PageSchema } from "./types";

type Migration = (schema: Record<string, unknown>) => Record<string, unknown>;

interface MigrationEntry {
  from: string;
  to: string;
  run: Migration;
}

/** 版本升级链。新增版本时在这里 push 一条，并把 to 改成新版本号 */
const MIGRATIONS: MigrationEntry[] = [
  {
    // 1.1.0 只新增可选字段 node.visibility，旧 Schema 无需结构变换。
    // 保留迁移入口是为了满足「语义变更必须升版本并留迁移函数」的契约。
    from: "1.0.0",
    to: "1.1.0",
    run: (schema) => schema,
  },
];

function compare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export interface MigrateResult {
  schema: PageSchema;
  /** 实际执行过的迁移，便于日志留痕 */
  applied: string[];
}

/**
 * 把任意版本的 Schema 迁到当前版本。
 * 只处理结构，不做合法性判断（合法性交给 validator）。
 */
export function migratePage(input: unknown): MigrateResult {
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error("不是合法的 JSON 文本");
    }
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Schema 必须是对象");
  }

  const working = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  const applied: string[] = [];
  let version = typeof working.schemaVersion === "string" ? working.schemaVersion : "1.0.0";
  working.schemaVersion = version;

  if (compare(version, SCHEMA_VERSION) > 0) {
    throw new Error(`Schema 版本 ${version} 高于当前渲染器支持的 ${SCHEMA_VERSION}`);
  }

  let guard = 0;
  while (compare(version, SCHEMA_VERSION) < 0) {
    const entry = MIGRATIONS.find((m) => m.from === version);
    if (!entry) {
      throw new Error(`缺少从 ${version} 升级到 ${SCHEMA_VERSION} 的迁移函数`);
    }
    Object.assign(working, entry.run(working));
    version = entry.to;
    working.schemaVersion = version;
    applied.push(`${entry.from} -> ${entry.to}`);
    if (++guard > 20) throw new Error("迁移链出现循环");
  }

  // 补默认结构，保证下游可以无脑读
  if (!working.meta || typeof working.meta !== "object") {
    working.meta = { title: "未命名页面", device: "pc" };
  }
  if (!Array.isArray(working.children)) working.children = [];

  return { schema: working as unknown as PageSchema, applied };
}
