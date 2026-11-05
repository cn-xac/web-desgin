import type { App, Plugin } from "vue";
import SchemaRenderer from "./renderer/SchemaRenderer.vue";

export interface VueDesignOptions {
  /** 全局组件名，默认 SchemaRenderer */
  componentName?: string;
}

/**
 * 以插件方式集成到已有 Vue 项目：
 *
 * ```ts
 * import { createVueDesign } from "@x-ac/design-vue";
 * import "@x-ac/design-vue/style.css";
 * app.use(createVueDesign());
 * ```
 *
 * 也可以在模板里直接按需使用：
 * `<SchemaRenderer :page="page" />`
 */
export function createVueDesign(options: VueDesignOptions = {}): Plugin {
  return {
    install(app: App) {
      app.component(options.componentName ?? "SchemaRenderer", SchemaRenderer);
    },
  };
}

export const VueDesignPlugin: Plugin = createVueDesign();
