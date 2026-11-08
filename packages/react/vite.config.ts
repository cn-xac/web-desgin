import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.json",
      entryRoot: "src",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      insertTypesEntry: false,
    }),
  ],
  build: {
    lib: {
      // index → 渲染器（带 styles.css）；kit → 扩展仓适配层 SDK（纯净、无 CSS 副作用）
      entry: {
        index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
        kit: fileURLToPath(new URL("./src/kit.ts", import.meta.url)),
      },
      formats: ["es"],
    },
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: false,
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@x-ac/design-core"],
      output: { entryFileNames: "[name].js", assetFileNames: "style.css" },
    },
  },
});
