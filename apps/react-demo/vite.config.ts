import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@x-ac/design-core", replacement: r("../../packages/core/src/index.ts") },
      { find: "@x-ac/design-react", replacement: r("../../packages/react/src/index.ts") },
      { find: "@", replacement: r("./src") },
    ],
  },
  server: { port: 5175, host: "127.0.0.1" },
});
