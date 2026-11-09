import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 本地 dev 走根路径；构建产物部署到 GitHub Pages 项目页（仓库 web-desgin）时，
// react 示例位于 /web-desgin/react/ 子路径。顺序敏感：/style.css、/kit 必须在 @x-ac/design-react 之前。
const isPages = process.env.NODE_ENV === "production";
export default defineConfig({
  base: isPages ? "/web-desgin/react/" : "/",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: "@x-ac/design-core", replacement: r("../../packages/core/src/index.ts") },
      { find: "@x-ac/design-react/style.css", replacement: r("../../packages/react/src/styles.css") },
      { find: "@x-ac/design-react/kit", replacement: r("../../packages/react/src/kit.ts") },
      { find: "@x-ac/design-react", replacement: r("../../packages/react/src/index.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  server: { port: 5175, host: "127.0.0.1" },
  build: { chunkSizeWarningLimit: 1200 },
});
