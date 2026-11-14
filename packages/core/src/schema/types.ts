/**
 * PageSchema 类型定义。
 * 与 docs/schema/page.schema.json 保持一一对应；改这里必须同步改 JSON Schema。
 */

import type { ValidationRule } from "../validation/rules";
import type { ExternalDataSource } from "../data/external";
import type { VisibilityConfig } from "../visibility/types";

export type DeviceType = "pc" | "pad" | "h5";

export type DirectiveName = "show" | "if" | "for";

export interface DirectiveSchema {
  name: DirectiveName;
  /** 受限表达式，例如 `list.length > 0` 或 `{{list}}` */
  value?: string;
  /** for 指令遍历时的别名，默认 item */
  itemKey?: string;
  /** for 指令遍历时的索引别名，默认 index */
  indexKey?: string;
}

export interface ActionSchema {
  /** 预注册动作名，JSON 中不允许出现可执行代码 */
  action: string;
  args?: Record<string, unknown>;
}

export interface NodeSchema {
  id: string;
  component: string;
  props?: Record<string, unknown>;
  style?: Record<string, string | number>;
  directives?: DirectiveSchema[];
  events?: Record<string, ActionSchema[]>;
  /**
   * 数据校验规则。挂在节点上而不是 props 里：
   * 校验是数据契约，与「用哪个控件展示」解耦。
   */
  rules?: ValidationRule[];
  /**
   * 外部数据源配置（rg4KCt）。
   * 挂在节点上：谁用它，决定了参数映射选哪些元素、响应映射写到哪里。
   */
  dataSource?: ExternalDataSource;
  /**
   * 显示 / 隐藏控制（r5u4Ul）。配置在目标节点自身，只控制该节点。
   * 与 directives 并存：未配置时回落到旧指令，旧 Schema 行为不变。
   */
  visibility?: VisibilityConfig;
  children?: NodeSchema[];
}

export interface DataSourceConfig {
  type: "http" | "static";
  url?: string;
  method?: "GET" | "POST";
  params?: Record<string, unknown>;
  auto?: boolean;
  data?: unknown;
}

export interface PageMeta {
  title?: string;
  device?: DeviceType;
  description?: string;
  [key: string]: unknown;
}

export interface PageSchema {
  schemaVersion: string;
  id: string;
  type: "page";
  meta?: PageMeta;
  /** 页面级响应式状态初值，渲染器注入 scope */
  state?: Record<string, unknown>;
  /** 声明式取数配置，键名即 scope 变量名 */
  dataSource?: Record<string, DataSourceConfig>;
  children: NodeSchema[];
}

/** 1.1.0：新增节点级 visibility 配置（r5u4Ul / rfD7Jv），旧字段语义未变 */
export const SCHEMA_VERSION = "1.1.0";

export function createEmptyPage(title = "未命名页面"): PageSchema {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `page_${Math.random().toString(36).slice(2, 10)}`,
    type: "page",
    meta: { title, device: "pc" },
    state: {},
    children: [],
  };
}
