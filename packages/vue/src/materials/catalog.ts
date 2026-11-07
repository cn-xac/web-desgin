/**
 * 当前生效的物料目录。
 *
 * 设计器与渲染器都必须读同一份 source of truth：适配包提供的 materials。
 * 适配包没带（或没注入）时回落 core 的通用清单，因此第三方适配包只写
 * components 也能跑，补了 materials 就能让属性面板多出专有字段。
 *
 * 返回值是不可变的查询对象，按 materials 数组引用缓存（adapter 是应用级单例）。
 */
import { inject } from "vue";
import { createRegistry, MATERIALS, type Material, type MaterialRegistry } from "@x-ac/design-core";
import { UI_ADAPTER } from "../renderer/context";

const cache = new WeakMap<Material[], MaterialRegistry>();

export function useMaterialCatalog(): MaterialRegistry {
  const adapter = inject(UI_ADAPTER, null);
  const materials: Material[] = adapter?.materials?.length ? adapter.materials : MATERIALS;
  let registry = cache.get(materials);
  if (!registry) {
    registry = createRegistry(materials);
    cache.set(materials, registry);
  }
  return registry;
}
