import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 扩展仓源码在兄弟目录，统一用本仓的 vue / element-plus，避免双运行时
    dedupe: ["vue", "element-plus"],
    // 顺序敏感：workspace 包按子路径优先匹配，最后才是 @ → 本应用 src
    alias: [
      { find: "@x-ac/design-core", replacement: r("../../packages/core/src/index.ts") },
      // 必须在包别名之前：否则 `@x-ac/design-vue/style.css` 会被拼成 `src/index.ts/style.css`
      { find: "@x-ac/design-vue/style.css", replacement: r("../../packages/vue/src/styles/tokens.css") },
      { find: "@x-ac/design-vue/designer", replacement: r("../../packages/vue/src/designer.ts") },
      { find: "@x-ac/design-vue", replacement: r("../../packages/vue/src/index.ts") },
      // 扩展包在兄弟仓库，开发期直接挂源码，不必先构建它的 dist
      { find: "@x-ac/design-vue-element-plus", replacement: r("../../../design-vue-element-plus/src/index.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
