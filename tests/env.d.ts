/**
 * 测试环境全局标志。
 *
 * 由 vitest.config.ts 通过 `define` 注入：
 *   - 本地联调且兄弟仓 design-vue-element-plus 存在时 → true；
 *   - CI 干净环境（兄弟仓不存在，别名回退到仓库内 stub）→ false。
 *
 * 凡依赖真实 EP 适配包（专有物料、Element Plus 控件渲染）的用例，
 * 用 `describe.skipIf(!__HAS_ELEMENT_PLUS__)` / `it.skipIf(!__HAS_ELEMENT_PLUS__)`
 * 跳过，保证发布流水线只跑三包自身的最小测试集。
 */
declare const __HAS_ELEMENT_PLUS__: boolean;
