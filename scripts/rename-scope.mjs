#!/usr/bin/env node
/**
 * 改 npm 包名（scope + 名称前缀）。
 *
 *   node scripts/rename-scope.mjs @acme                   # 只换 scope，保留原包名后缀
 *   node scripts/rename-scope.mjs @acme --prefix design-  # 顺带给包名加前缀
 *
 * 会同步改写：各可发布包的 name、包间依赖 key、源码 / 配置 / 文档里的 import 与提及，
 * 覆盖范围包括 project/ 下的 packages|apps|tests|docs|scripts、仓库根目录的
 * README.md / PROJECT.md / docs/。
 *
 * 幂等：目标名字和现有名字完全一致时不动任何文件，可重复执行。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "tmp", "coverage", ".turbo"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".vue", ".js", ".mjs", ".json", ".md", ".html", ".css", ".yaml", ".yml"]);

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const scope = argv.find((arg) => arg.startsWith("@"));
const prefixFlag = argv.indexOf("--prefix");
const prefix = prefixFlag >= 0 ? (argv[prefixFlag + 1] ?? "") : "";

if (!scope || !/^@[a-z0-9][a-z0-9._-]*$/i.test(scope)) {
  console.error("用法: node scripts/rename-scope.mjs @your-scope [--prefix design-]");
  console.error("  scope 只能包含字母、数字、- . _");
  process.exit(1);
}
if (prefix && !/^[a-z0-9][a-z0-9._-]*$/i.test(prefix)) {
  console.error(`--prefix 不合法: ${prefix}`);
  process.exit(1);
}

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(projectRoot, "..");

/* ---------- 现状：从 packages 下各包的 package.json 读当前包名 ---------- */
const packagesDir = join(projectRoot, "packages");
const current = [];
for (const dir of readdirSync(packagesDir)) {
  const pkgFile = join(packagesDir, dir, "package.json");
  if (!existsSync(pkgFile)) continue;
  const { name } = JSON.parse(readFileSync(pkgFile, "utf8"));
  if (!name) continue;
  const short = name.includes("/") ? name.slice(name.indexOf("/") + 1) : name;
  current.push({ dir, name, short, next: `${scope}/${prefix}${short}` });
}

if (!current.length) {
  console.error("没有在 packages/*/package.json 里找到任何包名");
  process.exit(1);
}

const renames = current.filter((pkg) => pkg.name !== pkg.next);
if (!renames.length) {
  console.log(`包名已经是 ${current.map((pkg) => pkg.name).join(" / ")}，无需修改`);
  process.exit(0);
}

/* ---------- 替换表：整包名优先，其次裸 scope ---------- */
const oldScopes = [...new Set(current.map((pkg) => (pkg.name.includes("/") ? pkg.name.split("/")[0] : "")))].filter(Boolean);
const pairs = [
  // 长串先替换，避免 @old/core 被裸 scope 规则抢先切碎
  ...renames.map((pkg) => [pkg.name, pkg.next]).sort((a, b) => b[0].length - a[0].length),
  ...oldScopes.filter((oldScope) => oldScope !== scope).map((oldScope) => [oldScope, scope]),
];

/* ---------- 收集要扫描的文件 ---------- */
function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".npmrc") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (TEXT_EXT.has(extname(entry.name))) files.push(full);
  }
  return files;
}

const targets = [];
// 整个 project/ 都扫（含根目录的 vite/vitest/tsconfig/pnpm-workspace 等配置），
// 早期版本只扫了 packages|apps|tests|docs|scripts，漏掉过 vitest.config.ts 的 alias
walk(projectRoot, targets);
for (const file of [
  join(repoRoot, "README.md"),
  join(repoRoot, "PROJECT.md"),
]) {
  try {
    if (statSync(file).isFile()) targets.push(file);
  } catch {
    /* 文件不存在就跳过 */
  }
}
walk(join(repoRoot, "docs"), targets);

/* ---------- 执行替换 ---------- */
let changed = 0;
for (const file of new Set(targets)) {
  const source = readFileSync(file, "utf8");
  if (!pairs.some(([from]) => source.includes(from))) continue;
  let next = source;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  if (next === source) continue;
  writeFileSync(file, next, "utf8");
  changed += 1;
  console.log(`  ✓ ${relative(repoRoot, file)}`);
}

console.log("");
for (const pkg of renames) console.log(`  ${pkg.name}  →  ${pkg.next}`);
console.log(`\n共修改 ${changed} 个文件`);
console.log("下一步：pnpm install && pnpm build:lib && pnpm typecheck && pnpm test");
