#!/usr/bin/env node
/**
 * 版本治理：fixed 单版本组。
 *
 * 决策见 ADR-15：所有可发布包永远共用一个版本号。一处改动一次发布，
 * 但发布出的每个 tarball 版本号相同，用户装哪个包都能靠版本号对齐，不产生兼容矩阵。
 * 因此不需要 changesets —— 它的价值在于「选择性 bump」，而 fixed 组恰好取消了这种选择性。
 *
 * 用法（在 project/ 下，也可从任意目录用绝对路径调用）：
 *   node scripts/release.mjs check                       # 校验版本一致性（CI / build 前置）
 *   node scripts/release.mjs version 0.4.0              # 统一改版本，只改 package.json
 *   node scripts/release.mjs version minor --dry-run    # 按 semver 递增，先看计划
 *   node scripts/release.mjs publish                    # 只打印发布计划（默认 dry-run）
 *   node scripts/release.mjs publish --yes              # 真正执行 pnpm -r publish（需单独批准）
 *
 * 红线：本脚本不 push、不建 tag、不自动发布。--yes 是唯一的执行开关。
 *
 * @typedef {{name: string, version: string, dir: string, file: string}} PackageInfo
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PACKAGES_DIR = join(PROJECT_ROOT, "packages");

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** 发现所有可发布包（packages/* 下非 private 的包），不依赖硬编码清单
 * @param {string} [packagesDir]
 * @returns {PackageInfo[]}
 */
export function discoverPackages(packagesDir = PACKAGES_DIR) {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "package.json"))
    .filter((file) => existsSync(file))
    .map((file) => {
      const pkg = JSON.parse(readFileSync(file, "utf8"));
      return { name: pkg.name, version: pkg.version, dir: join(file, ".."), file };
    })
    .filter((pkg) => pkg.name && pkg.version && !isPrivate(pkg.file))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {string} file */
function isPrivate(file) {
  return JSON.parse(readFileSync(file, "utf8")).private === true;
}

/**
 * 校验版本一致性。返回 mismatches 而不是直接抛错，便于 check 命令给出完整清单。
 * @param {Array<{name: string, version: string}>} packages
 */
export function assertAligned(packages) {
  if (!packages.length) return { ok: false, version: "", mismatches: [] };
  const version = packages[0].version;
  const mismatches = packages.filter((pkg) => pkg.version !== version);
  return { ok: mismatches.length === 0, version, mismatches };
}

/** 语义化版本比较，只用于阻止误降级；预发布版本低于同号正式版
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const split = (value) => {
    const [core, pre = ""] = value.split("-", 2);
    return [core.split(".").map((part) => Number(part) || 0), pre];
  };
  const [ac, ap] = split(a);
  const [bc, bp] = split(b);
  for (let i = 0; i < Math.max(ac.length, bc.length); i += 1) {
    const x = ac[i] ?? 0;
    const y = bc[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  if (ap === bp) return 0;
  if (!ap) return 1;
  if (!bp) return -1;
  return ap > bp ? 1 : -1;
}

/** 计算下一个版本号：显式版本或 patch / minor / major
 * @param {string} current
 * @param {string} kind
 */
export function bumpVersion(current, kind) {
  if (VERSION_RE.test(kind)) {
    if (compareVersions(kind, current) < 0) {
      throw new Error(`目标版本 ${kind} 低于当前版本 ${current}，拒绝降级`);
    }
    return kind;
  }
  const [major, minor, patch] = current.split(".").map((part) => Number(part.replace(/\D.*$/, "")) || 0);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`无法识别版本参数「${kind}」，应为 x.y.z 或 patch / minor / major`);
}

/** 只替换 package.json 里第一个顶层 version，保留文件其余内容与换行风格
 * @param {string} text
 * @param {string} version
 */
export function replaceVersionInText(text, version) {
  const re = /^(\s*"version"\s*:\s*")([^"]+)(")/m;
  if (!re.test(text)) throw new Error("package.json 里找不到 version 字段");
  return text.replace(re, (_match, left, _old, right) => `${left}${version}${right}`);
}

/** @param {PackageInfo[]} packages
 *  @param {string} version
 *  @param {{dryRun?: boolean}} [options]
 */
export function writeVersions(packages, version, options = {}) {
  const changed = [];
  for (const pkg of packages) {
    const text = readFileSync(pkg.file, "utf8");
    const next = replaceVersionInText(text, version);
    if (next === text) continue;
    changed.push({ name: pkg.name, file: pkg.file });
    if (!options.dryRun) writeFileSync(pkg.file, next, "utf8");
  }
  return changed;
}

/** 发布计划：pnpm 会把 workspace:* 替换成包自身的实际版本，单版本组正好保证替换一致
 * @param {string} version
 */
export function publishPlan(version) {
  return [
    'pnpm -r --filter "./packages/*" publish --access public',
    `# 发布后如需打 tag（脚本不代劳）：git tag -s v${version} -m "release ${version}"`,
  ];
}

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? "check";
  const packages = discoverPackages();
  const aligned = assertAligned(packages);

  if (command === "check") {
    for (const pkg of packages) console.log(`  ${pkg.name.padEnd(34)} ${pkg.version}`);
    if (!aligned.ok) {
      console.error("\n版本不一致，fixed 组要求所有可发布包同版本：");
      for (const item of aligned.mismatches) console.error(`  ${item.name} = ${item.version}（应为 ${aligned.version}）`);
      process.exit(1);
    }
    console.log(`\nOK：${packages.length} 个可发布包统一为 ${aligned.version}`);
    return;
  }

  if (command === "version") {
    if (!aligned.ok) {
      console.error("版本当前不一致，请先手工对齐或用 version 显式指定目标版本");
      process.exit(1);
    }
    const kind = argv[1];
    if (!kind) {
      console.error("用法: node scripts/release.mjs version <x.y.z | patch | minor | major> [--dry-run]");
      process.exit(1);
    }
    let version;
    try {
      version = bumpVersion(aligned.version, kind);
    } catch (error) {
      console.error(String(error.message));
      process.exit(1);
    }
    const dryRun = argv.includes("--dry-run");
    const changed = writeVersions(packages, version, { dryRun });
    console.log(`${dryRun ? "计划" : "已更新"}：${aligned.version} → ${version}，共 ${changed.length} 个包`);
    for (const item of changed) console.log(`  ${item.name}`);
    console.log("\n下一步（均需人工确认，脚本不自动执行）：");
    console.log("  pnpm install && pnpm build:lib && pnpm typecheck && pnpm test");
    console.log('  git add -A && git commit -S -s -m "chore(release): 版本升到 ' + version + '"');
    console.log("  node scripts/release.mjs publish          # 先看计划");
    console.log("  node scripts/release.mjs publish --yes    # 单独批准后执行");
    return;
  }

  if (command === "publish") {
    if (!aligned.ok) {
      console.error("版本不一致，拒绝发布");
      process.exit(1);
    }
    const missing = packages.filter((pkg) => !existsSync(join(pkg.dir, "dist", "index.js")));
    if (missing.length) {
      console.error("以下包还没有 dist 产物，请先 pnpm build:lib：");
      for (const pkg of missing) console.error(`  ${pkg.name}`);
      process.exit(1);
    }
    console.log(`发布计划：${packages.length} 个包，统一版本 ${aligned.version}`);
    for (const line of publishPlan(aligned.version)) console.log(`  ${line}`);
    if (!argv.includes("--yes")) {
      console.log("\n这是 dry-run。确认无误后加 --yes 才会真正发布（npm 发布需单独批准）。");
      return;
    }
    const result = spawnSync("pnpm", ["-r", "--filter", "./packages/*", "publish", "--access", "public"], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(result.status ?? 1);
  }

  console.error(`未知命令「${command}」。可用：check / version / publish`);
  process.exit(1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) main();
