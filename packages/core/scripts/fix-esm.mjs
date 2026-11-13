/**
 * tsc 在 moduleResolution=Bundler 下输出的是无扩展名的相对引用（./schema/types），
 * 这种产物只能被打包器消费，Node 直接 import 会失败。
 * 这里给所有相对引用补上 .js，让 core 同时满足「打包器」和「原生 ESM」两种消费方式。
 *
 * 目录 barrel 要补成 `<dir>/index.js` 而不是 `<dir>.js`：
 * tsc 输出的 "./data" 指的是 data/index.ts，补成 "./data.js" 会指向一个不存在的文件，
 * Node ESM 直接 ERR_MODULE_NOT_FOUND —— 发布出去的包整个加载不了。
 */
import { statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if ([".js", ".d.ts"].includes(extname(entry.name)) || entry.name.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

/** 相对引用 → 可被 Node 解析的相对引用 */
function withExtension(specifier, fileDir) {
  if (!specifier.startsWith(".")) return specifier;
  if (/\.(js|mjs|cjs|json|css)$/.test(specifier)) return specifier;
  // 指向目录（barrel）→ 指向该目录的 index
  try {
    if (statSync(resolve(fileDir, specifier)).isDirectory()) return `${specifier}/index.js`;
  } catch {
    /* 目标不存在：按普通文件补扩展名，交给构建期报错 */
  }
  return `${specifier}.js`;
}

const files = await collect(distDir);
let patched = 0;

for (const file of files) {
  const fileDir = dirname(file);
  const source = await readFile(file, "utf8");
  const next = source
    .replace(/(from\s*["'])(\.[^"']*)(["'])/g, (_m, head, spec, tail) => `${head}${withExtension(spec, fileDir)}${tail}`)
    .replace(/(import\(\s*["'])(\.[^"']*)(["']\s*\))/g, (_m, head, spec, tail) => `${head}${withExtension(spec, fileDir)}${tail}`);

  if (next !== source) {
    await writeFile(file, next, "utf8");
    patched += 1;
  }
}

console.log(`[core] 已为 ${patched} 个产物文件补齐 ESM 扩展名`);
