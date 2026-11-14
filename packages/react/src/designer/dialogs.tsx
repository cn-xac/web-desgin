/**
 * 设计器弹窗会话（对齐 Vue 的 designer/dialogs.ts）。
 *
 * 六个弹窗（绑定选择 / 选项录入 / 外部数据源 / 显示隐藏条件 / 子映射 / 请求头）
 * 都由属性面板或彼此触发，属于「跨组件的会话」：面板只负责打开，弹窗负责编辑与写回。
 *
 * Vue 侧用模块级 ref 单例；React 侧改成 Provider + Context：
 * 状态挂在 <DesignerDialogsProvider> 上，随设计器实例创建与销毁，
 * 多实例并行 / 测试之间不会互相污染（与「无全局可变注册表」的约定一致）。
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ExternalSubMap } from "@x-ac/web-design-core";
import { BindingPickerDialog } from "./components/BindingPicker";
import { OptionsDialog } from "./components/OptionsDialog";
import { ExternalSourceDialog } from "./components/ExternalSourceDialog";
import { ExternalSubMapDialog } from "./components/ExternalSubMapDialog";
import { HeadersDialog } from "./components/HeadersDialog";
import { ConditionDialog } from "./components/ConditionDialog";

/* ---------------- 落点定义 ---------------- */

/** 绑定的落点：哪个节点的哪个属性 */
export interface BindingTarget {
  nodeId: string;
  /** 属性键（props 里的键，或 style 里的键） */
  key: string;
  /** 属性名（弹窗标题用） */
  label: string;
  /** 写入位置 */
  where: "props" | "style";
}

/** 选项录入的落点 */
export interface OptionsTarget {
  nodeId: string;
  key: string;
  label: string;
}

/** 外部数据源的落点：配置写在页面级，节点只引用 */
export interface ExternalTarget {
  nodeId: string;
  label: string;
}

/** 条件配置的落点：哪个节点的显示条件或隐藏条件 */
export interface ConditionTarget {
  nodeId: string;
  label: string;
  kind: "show" | "hide";
}

/** 子映射的落点：属于哪条响应映射、目标子表单是谁 */
export interface SubMapTarget {
  /** 所属响应映射在草稿里的下标 */
  responseIndex: number;
  /** 父字段名（明细数组所在的字段） */
  parentField: string;
  /** 目标子表单节点 id */
  groupNodeId: string;
  /** 目标子表单名称（标题用） */
  label: string;
  /** 已有子映射 */
  maps: ExternalSubMap[];
}

/** 请求头的一行（编辑期间保留空名称的行，确定时才过滤） */
export interface HeaderRow {
  key: string;
  value: string;
}

export interface DesignerDialogsApi {
  openBinding(target: BindingTarget): void;
  closeBinding(): void;
  openOptions(target: OptionsTarget): void;
  closeOptions(): void;
  openExternal(target: ExternalTarget): void;
  closeExternal(): void;
  openConditions(target: ConditionTarget): void;
  closeConditions(): void;
  /** 打开子映射弹窗：resolve 出确认后的子映射，取消为 null（表示「没改」） */
  openSubMap(target: SubMapTarget): Promise<ExternalSubMap[] | null>;
  /** 打开请求头弹窗：resolve 出确认后的行，取消为 null（调用方须保留原值） */
  openHeaders(current: Record<string, string>): Promise<HeaderRow[] | null>;
}

const DialogsContext = createContext<DesignerDialogsApi | null>(null);

export function useDesignerDialogs(): DesignerDialogsApi {
  const value = useContext(DialogsContext);
  if (!value) throw new Error("[design-react] 弹窗 API 必须在 <SchemaDesigner> 内使用");
  return value;
}

export function DesignerDialogsProvider({ children }: { children: ReactNode }) {
  const [bindingTarget, setBindingTarget] = useState<BindingTarget | null>(null);
  const [optionsTarget, setOptionsTarget] = useState<OptionsTarget | null>(null);
  const [externalTarget, setExternalTarget] = useState<ExternalTarget | null>(null);
  const [conditionTarget, setConditionTarget] = useState<ConditionTarget | null>(null);
  const [subMapTarget, setSubMapTarget] = useState<SubMapTarget | null>(null);
  const [headerRows, setHeaderRows] = useState<HeaderRow[] | null>(null);

  const subMapResolve = useRef<((value: ExternalSubMap[] | null) => void) | null>(null);
  const headersResolve = useRef<((value: HeaderRow[] | null) => void) | null>(null);

  const closeBinding = useCallback(() => setBindingTarget(null), []);
  const closeOptions = useCallback(() => setOptionsTarget(null), []);
  const closeExternal = useCallback(() => setExternalTarget(null), []);
  const closeConditions = useCallback(() => setConditionTarget(null), []);

  const openSubMap = useCallback(
    (target: SubMapTarget) =>
      new Promise<ExternalSubMap[] | null>((resolve) => {
        subMapResolve.current = resolve;
        setSubMapTarget(target);
      }),
    [],
  );

  const confirmSubMap = useCallback((maps: ExternalSubMap[]) => {
    const resolve = subMapResolve.current;
    subMapResolve.current = null;
    setSubMapTarget(null);
    resolve?.(maps);
  }, []);

  const cancelSubMap = useCallback(() => {
    const resolve = subMapResolve.current;
    subMapResolve.current = null;
    setSubMapTarget(null);
    resolve?.(null);
  }, []);

  const openHeaders = useCallback(
    (current: Record<string, string>) =>
      new Promise<HeaderRow[] | null>((resolve) => {
        headersResolve.current = resolve;
        setHeaderRows(Object.entries(current).map(([key, value]) => ({ key, value })));
      }),
    [],
  );

  const confirmHeaders = useCallback((rows: HeaderRow[]) => {
    const resolve = headersResolve.current;
    headersResolve.current = null;
    setHeaderRows(null);
    resolve?.(rows);
  }, []);

  const cancelHeaders = useCallback(() => {
    const resolve = headersResolve.current;
    headersResolve.current = null;
    setHeaderRows(null);
    resolve?.(null);
  }, []);

  const api = useMemo<DesignerDialogsApi>(
    () => ({
      openBinding: (target) => setBindingTarget(target),
      closeBinding,
      openOptions: (target) => setOptionsTarget(target),
      closeOptions,
      openExternal: (target) => setExternalTarget(target),
      closeExternal,
      openConditions: (target) => setConditionTarget(target),
      closeConditions,
      openSubMap,
      openHeaders,
    }),
    [closeBinding, closeConditions, closeExternal, closeOptions, openHeaders, openSubMap],
  );

  return (
    <DialogsContext.Provider value={api}>
      {children}

      {bindingTarget ? <BindingPickerDialog target={bindingTarget} onClose={closeBinding} /> : null}
      {optionsTarget ? <OptionsDialog target={optionsTarget} onClose={closeOptions} /> : null}
      {externalTarget ? <ExternalSourceDialog target={externalTarget} onClose={closeExternal} /> : null}
      {conditionTarget ? <ConditionDialog target={conditionTarget} onClose={closeConditions} /> : null}
      {subMapTarget ? (
        <ExternalSubMapDialog target={subMapTarget} onCancel={cancelSubMap} onConfirm={confirmSubMap} />
      ) : null}
      {headerRows ? (
        <HeadersDialog initial={headerRows} onCancel={cancelHeaders} onConfirm={confirmHeaders} />
      ) : null}
    </DialogsContext.Provider>
  );
}
