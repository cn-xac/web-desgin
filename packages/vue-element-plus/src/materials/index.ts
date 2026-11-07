/**
 * Element Plus 适配包的物料清单 = core 通用清单（打上 EP 属性补丁）+ EP 专有物料。
 *
 * 三层的职责：
 * 1. core MATERIALS：跨库通用能力，任何适配包都该有；
 * 2. EP_FIELD_PATCHES：给既有物料补 EP 专有属性，同名键覆盖不重复；
 * 3. EP_BLOCK_MATERIALS / EP_FORM_MATERIALS：EP 才有的组件（标签页、穿梭框……）。
 *
 * 第 3 类统一标 `portable: false`：换到别的 UI 库这些物料不存在，
 * 参与跨库一致性测试没有意义，静态 HTML 导出也该老实给占位。
 */
import { bareKey, MATERIALS, materialKey, mergeFields, tagPortability, type Material } from "@x-ac/design-core";
import { EP_BLOCK_MATERIALS, type EpMaterial } from "./blocks";
import { EP_FIELD_PATCHES } from "./fields";
import { EP_FORM_MATERIALS } from "./forms";

export type { EpMaterial };
export { EP_FIELD_PATCHES } from "./fields";

/** EP 专有物料：裸名 → 协议名，补 owner / portable */
function toMaterial(source: EpMaterial): Material {
  return tagPortability({
    ...source,
    component: materialKey(source.component),
    owner: "adapter",
    portable: false,
  });
}

/**
 * 给 core 物料打补丁。
 * 用 mergeFields 而不是直接拼接：`size` / `clearable` 这类通用字段必然重名，
 * 拼两份会在属性面板里出现两个写同一个 prop 的输入框。
 */
const patched: Material[] = MATERIALS.map((material) => {
  const patch = EP_FIELD_PATCHES[bareKey(material.component)];
  if (!patch?.length) return material;
  return { ...material, fields: mergeFields(material.fields, patch) };
});

export const elementPlusMaterials: Material[] = [
  ...patched,
  ...EP_BLOCK_MATERIALS.map(toMaterial),
  ...EP_FORM_MATERIALS.map(toMaterial),
];
