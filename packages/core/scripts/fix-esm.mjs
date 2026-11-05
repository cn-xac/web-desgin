/**
 * tsc 在 moduleResolution=Bundler 下输出的是无扩展名的相对引用（./schema/types），
 * 这种产物只能被打包器消费，Node 直接 import 会失败。
 * 这里给所有相对引用补上 .js，让 core 同时满足「打包器」和「原生 ESM」两种消费方式。
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if ([".js", ".d.ts"].includes(extname(entry.name)) || entry.name.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

function withExtension(specifier) {
  if (!specifier.startsWith(".")) return specifier;
  if (/\.(js|mjs|cjs|json|css)$/.test(specifier)) return specifier;
  return `${specifier}.js`;
}

const files = await collect(distDir);
let patched = 0;

for (const file of files) {
  const source = await readFile(file, "utf8");
  const next = source
    .replace(/(from\s*["'])(\.[^"']*)(["'])/g, (_m, head, spec, tail) => `${head}${withExtension(spec)}${tail}`)
    .replace(/(import\(\s*["'])(\.[^"']*)(["']\s*\))/g, (_m, head, spec, tail) => `${head}${withExtension(spec)}${tail}`);

  if (next !== source) {
    await writeFile(file, next, "utf8");
    patched += 1;
  }
}

console.log(`[core] 已为 ${patched} 个产物文件补齐 ESM 扩展名`);
