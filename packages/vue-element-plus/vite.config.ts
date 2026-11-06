import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

/**
 * 适配包库模式构建：单入口，宿主依赖全部 external。
 * 产物只含「物料实现 + 绑定通道 + 动作副作用」，不含引擎，也不含 Element Plus 本体。
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      entryRoot: "src",
      include: ["src/**/*.ts", "src/**/*.vue"],
      insertTypesEntry: false,
      copyDtsFiles: false,
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
    },
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: false,
    rollupOptions: {
      external: ["vue", "element-plus", /^element-plus\//, "@x-ac/design-core"],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "style.css",
      },
    },
  },
});
