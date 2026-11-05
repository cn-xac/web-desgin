import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 顺序敏感：workspace 包按子路径优先匹配，最后才是 @ → 本应用 src
    alias: [
      { find: "@x-ac/design-core", replacement: r("../../packages/core/src/index.ts") },
      { find: "@x-ac/design-vue/designer", replacement: r("../../packages/vue/src/designer.ts") },
      { find: "@x-ac/design-vue", replacement: r("../../packages/vue/src/index.ts") },
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
