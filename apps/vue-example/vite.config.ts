import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 示例应用直接消费源码（workspace 包按子路径优先匹配，最后才是 @ → 本应用 src）。
// 顺序敏感：/style.css、/kit 必须在 @x-ac/design-vue 之前，否则会被拼成 src/index.ts/style.css。
export default defineConfig({
  base: "/",
  plugins: [vue()],
  resolve: {
    dedupe: ["vue"],
    alias: [
      { find: "@x-ac/design-core", replacement: r("../../packages/core/src/index.ts") },
      { find: "@x-ac/design-vue/style.css", replacement: r("../../packages/vue/src/styles/tokens.css") },
      { find: "@x-ac/design-vue/kit", replacement: r("../../packages/vue/src/kit.ts") },
      { find: "@x-ac/design-vue", replacement: r("../../packages/vue/src/index.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  server: { port: 5174, host: "127.0.0.1" },
  build: { chunkSizeWarningLimit: 1200 },
});
