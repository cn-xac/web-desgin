import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  esbuild: { jsx: "automatic" },
  resolve: {
    // 顺序敏感：前缀更具体的别名必须放在前面
    alias: [
      { find: "@x-ac/design-core", replacement: r("./packages/core/src/index.ts") },
      { find: "@x-ac/design-react", replacement: r("./packages/react/src/index.ts") },
      { find: "@x-ac/design-vue-element-plus", replacement: r("./packages/vue-element-plus/src/index.ts") },
      { find: "@x-ac/design-vue/designer", replacement: r("./packages/vue/src/designer.ts") },
      { find: "@x-ac/design-vue", replacement: r("./packages/vue/src/index.ts") },
      { find: "@/designer", replacement: r("./packages/vue/src/designer") },
      { find: "@/renderer", replacement: r("./packages/vue/src/renderer") },
      { find: "@/materials", replacement: r("./packages/vue/src/materials") },
      { find: "@/api", replacement: r("./apps/playground/src/api") },
      { find: "@/data", replacement: r("./apps/playground/src/data") },
      { find: "@/views", replacement: r("./apps/playground/src/views") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts", "tests/**/*.spec.tsx"],
    setupFiles: ["tests/setup.ts"],
    // 本机沙箱对 vite-node 的 ssr 临时写入受限，改用进程池可绕开该缓存
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
