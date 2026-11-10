/**
 * design-vue-element-plus 的仓库内占位导出。
 *
 * 该扩展仓是独立仓库（../design-vue-element-plus），仅在本地联调时存在；
 * CI 干净环境没有它（也不应该 checkout 进来）。vitest 别名在 CI 下指向本文件，
 * 提供最小兼容导出，避免测试因模块缺失而崩溃。真实的适配器 / 物料清单由
 * 兄弟仓库（或已发布的 npm 占位包）提供。
 *
 * 注意：本文件只用于「让 CI 测试不崩溃」，并不提供任何 EP 专有物料数据。
 * 依赖真实 EP 物料数据的用例请在 __HAS_ELEMENT_PLUS__ 为 false 时跳过
 * （见 tests/material-catalog.spec.ts）。
 *
 * 这里把 elementPlusAdapter.materials / elementPlusMaterials 填上 core 的
 * MATERIALS，是因为真实适配包本来就是在 core 清单之上追加 EP 专有项；
 * 这样「以 stub 为基座注册自定义物料 / 校验 / 物料面板」等用例在 CI 下仍
 * 能跑出真实行为，只有断言 EP 专有物料数量的用例才需要跳过。
 */
import { MATERIALS, type Material } from "@x-ac/web-design-core";

/** CI 干净环境下恒为 false；本地联调（兄弟仓存在）由 vitest define 注入 true。 */
export const HAS_ELEMENT_PLUS = false;

export const elementPlusAdapter = {
  name: "stub-element-plus",
  materials: MATERIALS,
  components: {},
  actions: {},
};

/** 占位：真实数据由兄弟仓库 / npm 占位包提供。 */
export const elementPlusMaterials: Material[] = MATERIALS;

/** 占位：真实数据由兄弟仓库 / npm 占位包提供。 */
export const EP_FIELD_PATCHES: Record<string, never[]> = {};
