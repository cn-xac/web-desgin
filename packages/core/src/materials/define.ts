/**
 * 业务组件注册（T-032）。
 *
 * 一份声明同时说清三件事：
 *   1. 组件实现（impl）—— Schema 里这个 component 长什么样；
 *   2. 物料元数据 —— 叫什么、在哪个分类、拖进画布的初始属性；
 *   3. 属性编辑方式 —— fields[].type 决定属性面板用输入框 / 下拉 / 开关 / 取色。
 *
 * 刻意不提供全局 register()：全局可变注册表在 SSR 多请求、测试并行、同页两个设计器
 * 实例之间会互相污染。注册结果是「一份新的 adapter」，谁注入谁生效 —— 与 withMaterials 同源。
 */
import type { UiAdapter } from "./adapter";
import { isProtocolMaterial, materialKey } from "./keys";
import { fieldPortability } from "./portability";
import type { Material, MaterialCategory, MaterialEvent, MaterialKind, PropField } from "./types";

/** 业务物料的声明形状。除 component 外全部可选，缺省值保证「最小写法也能跑」。 */
export interface CustomMaterialInput<TComponent = unknown> {
  /** Schema 里的 component 值。建议业务前缀（biz-xxx / 公司缩写），不要占用协议命名空间 ec- */
  component: string;
  /** 物料面板与属性面板显示的名字，缺省用 component */
  title?: string;
  /** 缺省 display */
  kind?: MaterialKind;
  /** 缺省「业务」，想并入现有分类就显式写 */
  category?: MaterialCategory;
  /** 物料面板图标（单字符），缺省取标题首字 */
  icon?: string;
  /** 组件实现：Vue 组件对象 / React 组件 / 原生标签字符串，由对应引擎解释 */
  impl?: TComponent;
  /** 默认属性，拖进画布时的初始值（不落库，节点没写该键时生效） */
  props?: Record<string, unknown>;
  /** 属性面板的字段表；type 即编辑方式 */
  fields?: PropField[];
  events?: MaterialEvent[];
  acceptsChildren?: boolean;
  /** 正文来自哪个属性（等同内置 click 按钮的 text） */
  textProp?: string;
  /** 渲染器消费、不透传 DOM 的属性 */
  internalProps?: string[];
  isFormControl?: boolean;
  hint?: string;
  defaultStyle?: Record<string, string>;
  /**
   * 是否可被其它 UI 库渲染。业务物料默认 false：
   * 不参加跨库一致性测试，静态 HTML 导出走占位。
   * 只有当 impl 用的是协议内通用 DOM 语义（原生标签等）时才建议置 true。
   */
  portable?: boolean;
}

export interface CustomMaterial<TComponent = unknown> {
  material: Material;
  /** 未提供时引擎降级为占位块，物料仍能在面板里出现（便于先占位后实现） */
  impl?: TComponent;
}

/** 标题首字作图标：规避引入图标包的体积，也避免每个业务物料手写一个符号 */
function initial(value: string): string {
  return Array.from(value)[0] ?? "◇";
}

/**
 * 把一份业务声明规范化成引擎认识的 Material。
 *
 * 校验只做两件必须拦下的事：
 *   - component 为空 → 无法落库；
 *   - 占用 ec- 协议命名空间 → 会悄悄顶掉官方物料语义，比直接报错危险得多。
 */
export function defineMaterial<TComponent = unknown>(
  input: CustomMaterialInput<TComponent>,
): CustomMaterial<TComponent> {
  const component = String(input.component ?? "").trim();
  if (!component) {
    throw new TypeError("[defineMaterial] component 不能为空");
  }
  if (isProtocolMaterial(component)) {
    const suggestion = `biz-${component.slice(3)}`;
    throw new TypeError(
      `[defineMaterial] ${component} 属于协议命名空间（ec-）：` +
        `业务物料请改用自带前缀（如 ${suggestion}）；` +
        "要补充官方物料的字段请用 withMaterials()",
    );
  }

  const title = input.title?.trim() || component;
  const fields = (input.fields ?? []).map((field) => ({ ...field, portability: fieldPortability(field) }));

  const material: Material = {
    component,
    title,
    category: input.category ?? "业务",
    kind: input.kind ?? "display",
    icon: input.icon ?? initial(title),
    defaultProps: { ...(input.props ?? {}) },
    fields,
    owner: "user",
    portable: input.portable ?? false,
    ...(input.defaultStyle ? { defaultStyle: input.defaultStyle } : {}),
    ...(input.events ? { events: input.events } : {}),
    ...(input.acceptsChildren === undefined ? {} : { acceptsChildren: input.acceptsChildren }),
    ...(input.textProp ? { textProp: input.textProp } : {}),
    ...(input.internalProps ? { internalProps: input.internalProps } : {}),
    ...(input.isFormControl === undefined ? {} : { isFormControl: input.isFormControl }),
    ...(input.hint ? { hint: input.hint } : {}),
  };

  return { material, impl: input.impl };
}

export interface RegisterMaterialsOptions {
  /** 允许覆盖同名物料。缺省 false：同名一律报错，避免业务物料悄悄顶掉官方物料 */
  overwrite?: boolean;
}

/** 同一批里既接受 defineMaterial() 的产物，也接受裸声明（自动规范化） */
function isRegistered(value: CustomMaterial<unknown> | CustomMaterialInput<unknown>): value is CustomMaterial<unknown> {
  const material = (value as CustomMaterial<unknown>).material;
  return typeof material === "object" && material !== null;
}

/**
 * 把业务物料组合进适配包，返回新的 adapter（不改入参）。
 *
 * ```ts
 * const adapter = registerMaterials(elementPlusAdapter, [
 *   { component: "biz-rate", title: "满意度", kind: "field", impl: BizRate,
 *     props: { modelValue: "", max: 5 },
 *     fields: [{ key: "max", label: "最高分", type: "number" }] },
 * ]);
 * ```
 *
 * 组件表按 materialKey 归一写入（与 Schema 里的协议名同一套规则），
 * 所以 Schema 写 `biz-rate`、适配包按 `ec-biz-rate` 查，两边都能命中。
 */
export function registerMaterials<TComponent>(
  adapter: UiAdapter<TComponent>,
  definitions: ReadonlyArray<CustomMaterial<TComponent> | CustomMaterialInput<TComponent>>,
  options: RegisterMaterialsOptions = {},
): UiAdapter<TComponent> {
  if (!definitions.length) return adapter;

  const materials = [...adapter.materials];
  const slots = new Map<string, number>();
  materials.forEach((item, index) => slots.set(materialKey(item.component), index));

  const components: Record<string, TComponent> = { ...adapter.components };
  const handled = new Set<string>();

  for (const definition of definitions) {
    const { material, impl } = isRegistered(definition)
      ? (definition as CustomMaterial<TComponent>)
      : defineMaterial(definition as CustomMaterialInput<TComponent>);

    const key = materialKey(material.component);
    if (handled.has(key)) {
      throw new TypeError(`[registerMaterials] 同一批里重复注册：${material.component}`);
    }
    handled.add(key);

    const at = slots.get(key);
    if (at === undefined) {
      slots.set(key, materials.length);
      materials.push(material);
    } else if (options.overwrite) {
      materials[at] = material;
    } else {
      throw new TypeError(
        `[registerMaterials] ${material.component} 与已有物料同名；确实要覆盖请传 { overwrite: true }`,
      );
    }

    if (impl !== undefined) components[key] = impl;
  }

  return { ...adapter, materials, components };
}
