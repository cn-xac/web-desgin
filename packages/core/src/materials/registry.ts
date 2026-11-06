/**
 * 物料注册表。
 *
 * 刻意做成「值对象 + 纯查询」，不是全局单例：
 * 适配包带自己的 materials，宿主用 withMaterials() 组合，
 * 这样 SSR 多请求、测试并行、同页两个设计器实例都不会串。
 *
 * 所有查询都做前缀归一：Schema 里写 `ec-input` 或历史数据里的 `input` 都能查到同一份 meta。
 */
import { materialKey } from "./keys";
import type { Material, MaterialCategory } from "./types";

export interface MaterialRegistry {
  get(key: string): Material | undefined;
  has(key: string): boolean;
  all(): Material[];
  keys(): string[];
  byCategory(): Array<{ category: MaterialCategory; items: Material[] }>;
  /** 给定组件名清单，返回当前注册表里找不到的那些（跨库降级、历史数据迁移用） */
  missing(keys: string[]): string[];
}

export const CATEGORIES: MaterialCategory[] = ["布局", "展示", "表单", "交互", "业务"];

export function createRegistry(materials: Material[]): MaterialRegistry {
  const byComponent = new Map<string, Material>();
  for (const material of materials) {
    byComponent.set(materialKey(material.component), material);
  }

  const lookup = (key: string): Material | undefined =>
    byComponent.get(materialKey(key)) ?? byComponent.get(key);

  return {
    get: lookup,
    has: (key) => lookup(key) !== undefined,
    all: () => [...byComponent.values()],
    keys: () => [...byComponent.keys()],
    byCategory: () =>
      CATEGORIES.map((category) => ({
        category,
        items: [...byComponent.values()].filter((material) => material.category === category),
      })),
    missing: (keys) => keys.filter((key) => lookup(key) === undefined),
  };
}
