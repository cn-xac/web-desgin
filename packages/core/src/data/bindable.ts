/**
 * 可绑定数据清单（对应待办 ruUqAF「快速选择可绑定数据 / 生成可绑定数据」）。
 *
 * 设计器里要回答一个问题：**这个属性现在能绑哪些数据？**
 * 答案不能靠人背路径（`form.xxx` / `external.deptList` / `state.user.name`），
 * 也不能靠用户手写表达式试错 —— 必须从当前页面 Schema 里「生成」一份清单。
 *
 * 本模块是这份清单的唯一来源，框架无关：
 * - 设计器把它渲染成「可绑定数据」弹窗，点一条即完成绑定；
 * - 外部数据源的参数映射 / 响应映射也从同一份清单里选元素，
 *   保证「能绑的」和「能映射的」是同一批东西，不会各说各话。
 *
 * 路径来源与运行时的绑定规则严格对齐：
 * - 表单控件未显式设置 modelValue 时自动绑 `form.<节点ID>`（与 SchemaNode 一致）；
 * - 子表单内控件绑 `<父前缀>.<明细路径>[组下标].<节点ID>`；
 * - 页面 state 与 dataSource 的键直接是 scope 顶层键。
 */

import type { NodeSchema, PageSchema } from "../schema/types";
import { extractPath } from "../schema/expression";
import { MATERIALS } from "../materials/catalog";
import { bareKey } from "../materials/keys";
import { createRegistry, type MaterialRegistry } from "../materials/registry";
import type { Material } from "../materials/types";

export type BindableKind = "state" | "field" | "datasource" | "external";

export interface BindableItem {
  /** 绑定路径，写进 {{}} 即完成绑定 */
  path: string;
  /** 展示名 */
  label: string;
  /** 所属分组 */
  group: string;
  kind: BindableKind;
  /** 补充说明：元素类型、数据源地址等 */
  hint?: string;
  /** 搜索关键字（label + path + hint 小写拼接），供弹窗过滤 */
  keywords: string;
}

export interface CollectBindableOptions {
  /** 物料目录；缺省用 core 通用清单 */
  registry?: MaterialRegistry;
  /** 页面状态展开的最大层级；1 = 顶层 key + 再展开一层对象。缺省 2 */
  stateDepth?: number;
}

const GROUP_STATE = "页面状态";
const GROUP_FIELD = "表单字段";
const GROUP_DATASOURCE = "页面数据源";
const GROUP_EXTERNAL = "外部数据源";

/** 明细数组的组下标占位：设计期还没有真实数据，用 0 代表「任意一组」 */
const GROUP_INDEX = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeItem(
  path: string,
  label: string,
  group: string,
  kind: BindableKind,
  hint?: string,
): BindableItem {
  return {
    path,
    label,
    group,
    kind,
    hint,
    keywords: `${label} ${path} ${hint ?? ""}`.toLowerCase(),
  };
}

/* ----------------------------- 页面状态 ----------------------------- */

/**
 * 页面 state 的键直接进 scope 顶层，因此 key 本身就是绑定路径。
 * 对象再展开一层：用户真正想绑的通常是 `user.name` 而不是整个 `user`。
 */
function collectState(state: Record<string, unknown> | undefined, depth: number): BindableItem[] {
  if (!isPlainObject(state)) return [];
  const out: BindableItem[] = [];

  for (const [key, value] of Object.entries(state)) {
    out.push(makeItem(key, key, GROUP_STATE, "state", describeValue(value)));
    if (depth > 1 && isPlainObject(value)) {
      for (const [subKey, subValue] of Object.entries(value)) {
        out.push(
          makeItem(`${key}.${subKey}`, `${key}.${subKey}`, GROUP_STATE, "state", describeValue(subValue)),
        );
      }
    }
  }
  return out;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `数组（${value.length} 项）`;
  if (isPlainObject(value)) return "对象";
  if (value === null || value === undefined) return "空";
  return typeof value === "string" ? "文本" : typeof value === "number" ? "数字" : "布尔";
}

/* ----------------------------- 表单字段 ----------------------------- */

/**
 * 遍历节点树，收集表单控件的绑定路径。
 *
 * base 是当前作用域前缀：页面根为 `form`，子表单组内为 `form.<明细路径>[i]`。
 * 控件路径取「显式 modelValue 绑定 > 自动绑定」：
 * 显式绑定了 `{{form.dept}}` 的控件，真实数据就落在 form.dept，
 * 清单里也必须写 form.dept，否则用户选了 form.<节点ID> 却读不到值。
 */
function collectFields(
  nodes: NodeSchema[],
  registry: MaterialRegistry,
  base: string,
  out: BindableItem[],
): void {
  for (const node of nodes ?? []) {
    const material = registry.get(node.component);

    if (material?.kind === "subform") {
      const itemPath = String(node.props?.itemPath ?? "items");
      const fullPath = itemPath ? `${base}.${itemPath}` : base;
      out.push(makeItem(fullPath, material.title, GROUP_FIELD, "field", "明细数组（整组）"));
      // 组内控件：组下标取 0 作为占位
      collectFields(node.children ?? [], registry, `${fullPath}[${GROUP_INDEX}]`, out);
      continue;
    }

    if (material?.isFormControl) {
      const explicit = extractPath(node.props?.modelValue);
      const path = explicit ?? `${base}.${node.id}`;
      out.push(makeItem(path, fieldLabel(node, material), GROUP_FIELD, "field", material.title));
    }

    // 普通容器节点继续下钻：容器内的表单控件仍绑在同一个前缀下
    collectFields(node.children ?? [], registry, base, out);
  }
}

function fieldLabel(node: NodeSchema, material: Material): string {
  const label = node.props?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return material.title;
}

/* ----------------------------- 数据源 ----------------------------- */

/** 页面级 dataSource 的键写进 scope 顶层，键即路径 */
function collectPageDataSources(page: PageSchema): BindableItem[] {
  return Object.entries(page.dataSource ?? {}).map(([key, item]) =>
    makeItem(key, key, GROUP_DATASOURCE, "datasource", item?.url ?? "静态数据"),
  );
}

/** 外部数据源的响应写进 scope.response.scopePath，那个路径即可绑定项 */
function collectExternalSources(page: PageSchema): BindableItem[] {
  const out: BindableItem[] = [];
  const walk = (nodes: NodeSchema[]): void => {
    for (const node of nodes ?? []) {
      const source = node.dataSource;
      const scopePath = source?.response?.scopePath;
      if (scopePath) {
        out.push(
          makeItem(scopePath, scopePath, GROUP_EXTERNAL, "external", source?.name ?? source?.url ?? ""),
        );
      }
      walk(node.children ?? []);
    }
  };
  walk(page.children ?? []);
  return out;
}

/* ----------------------------- 元素清单 ----------------------------- */

/**
 * 可以作为「选项来源」的组件。
 *
 * 这些组件的 options 由外部数据源接管时，返回结果要按 label/value 映射成选项，
 * 与普通输入类元素（整个响应写进它的值）处理方式不同。
 */
export const OPTION_COMPONENTS = new Set([
  "select",
  "radio",
  "checkbox",
  "cascader",
  "tree-select",
  "transfer",
  "autocomplete",
  "dict-select",
]);

/** 可选元素（节点 + 它的绑定路径） */
export interface BindableElement {
  nodeId: string;
  /** 元素的绑定路径：控件是 form.<节点ID>，明细数组是 form.<明细路径> */
  path: string;
  /** 展示名 */
  label: string;
  /** 物料标题 */
  title: string;
  component: string;
  /** 是否选项类元素（可以接外部数据源的选项映射） */
  isOption: boolean;
  /** 是否明细容器（可整体作为单个参数值） */
  isGroup: boolean;
}

/**
 * 收集页面里可被选择的元素。
 *
 * 与 collectBindableData 的区别：这里给的是「节点」而不是「数据项」，
 * 供外部数据源做参数映射 / 响应映射时选元素用。
 */
export function collectBindableElements(
  page: PageSchema,
  options: CollectBindableOptions = {},
): BindableElement[] {
  const registry = options.registry ?? createRegistry(MATERIALS);
  const out: BindableElement[] = [];

  const walk = (nodes: NodeSchema[], base: string): void => {
    for (const node of nodes ?? []) {
      const material = registry.get(node.component);

      if (material?.kind === "subform") {
        const itemPath = String(node.props?.itemPath ?? "items");
        const fullPath = itemPath ? `${base}.${itemPath}` : base;
        out.push({
          nodeId: node.id,
          path: fullPath,
          label: material.title,
          title: material.title,
          component: node.component,
          isOption: false,
          isGroup: true,
        });
        walk(node.children ?? [], `${fullPath}[${GROUP_INDEX}]`);
        continue;
      }

      if (material?.isFormControl) {
        const explicit = extractPath(node.props?.modelValue);
        out.push({
          nodeId: node.id,
          path: explicit ?? `${base}.${node.id}`,
          label: fieldLabel(node, material),
          title: material.title,
          component: node.component,
          isOption: OPTION_COMPONENTS.has(bareKey(node.component)),
          isGroup: false,
        });
      }

      walk(node.children ?? [], base);
    }
  };

  walk(page.children ?? [], "form");
  return out;
}

/* ----------------------------- 对外入口 ----------------------------- */

/**
 * 生成当前页面的可绑定数据清单。
 *
 * 同一路径可能出现多次（例如 state 里已有 user.name，表单里也有个控件绑到 user.name），
 * 这里按 path 去重，先到先得（状态 → 表单 → 数据源 → 外部数据源的顺序）。
 */
export function collectBindableData(
  page: PageSchema,
  options: CollectBindableOptions = {},
): BindableItem[] {
  const registry = options.registry ?? createRegistry(MATERIALS);
  const depth = options.stateDepth ?? 2;

  const fields: BindableItem[] = [];
  collectFields(page.children ?? [], registry, "form", fields);

  const items: BindableItem[] = [
    ...collectState(page.state, depth),
    ...fields,
    ...collectPageDataSources(page),
    ...collectExternalSources(page),
  ];

  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.path || seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

/** 按关键字过滤清单（弹窗搜索用） */
export function filterBindableData(items: BindableItem[], keyword: string): BindableItem[] {
  const text = keyword.trim().toLowerCase();
  if (!text) return items;
  return items.filter((item) => item.keywords.includes(text));
}

/** 按分组归拢（弹窗分组展示用） */
export function groupBindableData(items: BindableItem[]): Array<{ group: string; items: BindableItem[] }> {
  const map = new Map<string, BindableItem[]>();
  for (const item of items) {
    const list = map.get(item.group);
    if (list) list.push(item);
    else map.set(item.group, [item]);
  }
  return Array.from(map, ([group, list]) => ({ group, items: list }));
}
