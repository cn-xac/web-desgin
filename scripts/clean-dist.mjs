#!/usr/bin/env node
/**
 * 构建前清空 dist。
 *
 * 各包原先关掉了 Vite 的 emptyOutDir（当时沙箱对 rmSync 有限制），
 * 导致连续构建会在 dist 里留下哈希不同的旧 chunk，发布时一起进 tarball。
 * 这里用 Node 自己删，跨平台且不受 shell 限制。
 */
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), process.argv[2] ?? "dist");
if (!target.includes("dist")) {
  console.error(`拒绝删除非 dist 目录：${target}`);
  process.exit(1);
}
if (existsSync(target)) rmSync(target, { recursive: true, force: true });
console.log(`[clean] 已清空 ${target}`);
