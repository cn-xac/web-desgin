import { fileURLToPath, URL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 扩展仓 design-vue-element-plus 是独立仓库，仅在本地联调时存在；CI 干净环境没有它。
// 用 CI_NO_EP=1 可本地模拟 CI（强制走仓库内 stub），验证发布链路。
const hasEp = process.env.CI_NO_EP ? false : existsSync(r("../design-vue-element-plus/src/index.ts"));

/**
 * Vite 8 的 SSR 环境不再自动把 Node fs 交给 @vue/compiler-sfc，
 * 而扩展仓的 defineProps<ImportedType>() 需要读文件解析类型，故显式提供。
 * 只实现 compiler-sfc 需要的两个方法，不引入额外依赖。
 */
const sfcFs = {
  fileExists: (file: string) => existsSync(file),
  readFile: (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : undefined),
};

export default defineConfig({
  // 把「是否有 element-plus 扩展仓」注入测试，便于按环境跳过依赖真实 EP 数据的用例
  define: {
    __HAS_ELEMENT_PLUS__: hasEp,
  },
  plugins: [vue({ script: { fs: sfcFs } })],
  // Vite 8 用 oxc 取代 esbuild；esbuild 选项已废弃，JSX 必须在这里声明。
  // 用对象形态 { runtime: "automatic" }：vue 插件会把 jsx 选项原样传给 oxc，
  // 字符串 "automatic" 会被 oxc 校验拒绝（仅 .tsx 路径会自动转换），对象形态两条路径都合法。
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    // 扩展仓源码在兄弟目录，其 import 会落到对方 node_modules；
    // 强制去重到本仓的 vue / element-plus，避免双 Vue 运行时导致 provide/inject 失效
    dedupe: ["vue", "element-plus"],
    // 顺序敏感：前缀更具体的别名必须放在前面
    alias: [
      { find: "@x-ac/design-core", replacement: r("./packages/core/src/index.ts") },
      // 顺序敏感：子路径必须先于包别名
      { find: "@x-ac/design-react/kit", replacement: r("./packages/react/src/kit.ts") },
      { find: "@x-ac/design-react/designer", replacement: r("./packages/react/src/designer.ts") },
      { find: "@x-ac/design-react", replacement: r("./packages/react/src/index.ts") },
      // 扩展仓基于适配层 SDK 子入口；必须在 @x-ac/design-vue 之前匹配
      { find: "@x-ac/design-vue/kit", replacement: r("./packages/vue/src/kit.ts") },
      // 扩展包已拆到兄弟仓库 design-vue-element-plus，本地联调直接吃它的源码；
      // CI 干净环境没有它，别名回退到仓库内 stub（仅提供最小兼容导出）。
      ...(hasEp
        ? [{ find: "@x-ac/design-vue-element-plus", replacement: r("../design-vue-element-plus/src/index.ts") }]
        : [{ find: "@x-ac/design-vue-element-plus", replacement: r("./tests/fixtures/element-plus-stub.ts") }]),
      { find: "@x-ac/design-vue/designer", replacement: r("./packages/vue/src/designer.ts") },
      { find: "@x-ac/design-vue", replacement: r("./packages/vue/src/index.ts") },
      { find: "@/designer", replacement: r("./packages/vue/src/designer") },
      { find: "@/renderer", replacement: r("./packages/vue/src/renderer") },
      { find: "@/materials", replacement: r("./packages/vue/src/materials") },
      // 测试 fixture（精简 apps 后从 playground/react-demo 迁入 tests/fixtures）
      { find: "@/demo-materials", replacement: r("./tests/fixtures") },
      { find: "@/api", replacement: r("./tests/fixtures") },
      { find: "@/data", replacement: r("./tests/fixtures") },
      { find: "@/fixtures", replacement: r("./tests/fixtures") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx"],
    setupFiles: ["tests/setup.ts"],
    // Vitest 4 起 poolOptions 移除，单文件串行改用顶层 fileParallelism
    pool: "forks",
    fileParallelism: false,
    // 关掉文件系统模块缓存：其清缓存会递归删除 node_modules/.vitest-cache，
    // 在受限沙箱里会触发批量删除保护；CI 里也可按需打开加速冷启动
    fsModuleCache: false,
  },
});
