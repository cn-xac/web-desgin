/**
 * @x-ac/design-vue —— 渲染器入口（轻量，不含设计器）。
 *
 * 集成方式一（插件）：
 *   import { createVueDesign } from "@x-ac/design-vue";
 *   app.use(createVueDesign());
 *
 * 集成方式二（按需）：
 *   import { SchemaRenderer } from "@x-ac/design-vue";
 */
import "./styles/tokens.css";

export * from "./renderer";
export { useMaterialCatalog } from "./materials/catalog";
export { createVueDesign, VueDesignPlugin } from "./plugin";
export type { VueDesignOptions } from "./plugin";

// 常用内核能力透出，宿主不必再单独安装 core
export {
  DEFAULT_BINDING,
  MATERIALS,
  createEmptyPage,
  getMaterial,
  materialKey,
  migratePage,
  resolveDefaults,
  toHtml,
  toJSON,
  validatePage,
} from "@x-ac/design-core";
export type { Material, NodeSchema, PageSchema, UiAdapter } from "@x-ac/design-core";
