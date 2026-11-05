import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  build: {
    // 渲染器必须能独立成包；设计器走动态 import，单独 chunk
    chunkSizeWarningLimit: 1200,
  },
});
