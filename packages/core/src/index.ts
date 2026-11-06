/**
 * @x-ac/design-core —— 框架无关的搭建内核。
 *
 * 约束（改动前请先读）：
 * 1. 本包不得 import vue / react / element-plus，也不得访问 window、document；
 * 2. 所有能力都必须是「纯函数 + 显式注入」，副作用一律通过参数传入；
 * 3. 产出的 PageSchema 是唯一事实来源，跨框架（Vue / React / 静态 HTML）通用。
 */

export * from "./schema/types";
export * from "./schema/expression";
export * from "./schema/tree";
export * from "./schema/validator";
export * from "./schema/serialize";
export * from "./schema/migrate";

export * from "./validation/rules";
export * from "./validation/engine";

export * from "./materials/types";
export * from "./materials/keys";
export * from "./materials/portability";
export * from "./materials/adapter";
export * from "./materials/registry";
export * from "./materials/catalog";
export * from "./materials/utils";

export * from "./utils/clone";

export * from "./style/spacing";
export * from "./style/style";

export * from "./actions/registry";

export * from "./export/html";
export * from "./export/data";
