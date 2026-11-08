/**
 * 页面仓储（Vue 侧兼容入口）。
 *
 * 实现已下沉到 @x-ac/design-core：Vue 与 React 的 designer 子入口必须共用
 * 同一个全局单例，否则宿主在 Vue 包注入的仓储，React 设计器读不到。
 * 这里保留路径是为了不破坏既有 import。
 */

export {
  createMemoryRepository,
  getPageRepository,
  setPageRepository,
} from "@x-ac/design-core";
export type { PageRecord, PageRepository } from "@x-ac/design-core";
