import type { App, Plugin } from "vue";
import type { UiAdapter } from "@x-ac/web-design-core";
import SchemaRenderer from "./renderer/SchemaRenderer.vue";
import { UI_ADAPTER } from "./renderer/context";

export interface VueDesignOptions {
  /** 渲染标签的全局组件名，默认同时注册 SchemaRenderer 与 SchemaPage（二者等同） */
  componentName?: string;
  /** 语义化别名 <SchemaPage> 的注册名；false 表示不注册别名 */
  pageComponentName?: string | false;
  /**
   * UI 适配包（应用级单例）。例如：
   *   import { elementPlusAdapter } from "@x-ac/web-design-vue-element-plus";
   *   app.use(createVueDesign({ adapter: elementPlusAdapter }));
   */
  adapter?: UiAdapter<unknown>;
}

/**
 * 以插件方式集成到已有 Vue 项目（标签即用）：
 *
 * ```ts
 * import { createVueDesign } from "@x-ac/web-design-vue";
 * import { elementPlusAdapter } from "@x-ac/web-design-vue-element-plus";
 * import "@x-ac/web-design-vue/style.css";
 * app.use(createVueDesign({ adapter: elementPlusAdapter }));
 * ```
 *
 * 模板里即可直接写，两个名字指向同一组件：
 *
 * ```vue
 * <SchemaRenderer :page="schema" v-model:data="formData" @submit="onSubmit" />
 * <SchemaPage :page="schemaJson" v-model:data="formData" @submit="onSubmit">
 *   <template #empty>自定义空态</template>
 * </SchemaPage>
 * ```
 */
export function createVueDesign(options: VueDesignOptions = {}): Plugin {
  return {
    install(app: App) {
      if (options.adapter) app.provide(UI_ADAPTER, options.adapter);
      app.component(options.componentName ?? "SchemaRenderer", SchemaRenderer);
      const alias = options.pageComponentName !== false ? (options.pageComponentName ?? "SchemaPage") : "";
      if (alias && alias !== (options.componentName ?? "SchemaRenderer")) {
        app.component(alias, SchemaRenderer);
      }
    },
  };
}

export const VueDesignPlugin: Plugin = createVueDesign();
