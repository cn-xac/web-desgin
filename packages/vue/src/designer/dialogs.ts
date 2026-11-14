/**
 * 设计器弹窗状态。
 *
 * 三个弹窗（绑定选择 / 选项录入 / 外部数据源）都由属性面板触发，
 * 但它们是「跨组件的会话」：面板只负责打开，弹窗负责编辑与写回。
 * 用模块级单例承载状态，避免逐层透传 props / emit。
 *
 * 组件内部不读路由、不写 localStorage，这里只是内存态，宿主刷新即失效 —— 正合适。
 */
import { ref } from "vue";
import type { ExternalSubMap } from "@x-ac/web-design-core";

/* ---------------- 绑定选择器 ---------------- */

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

const bindingVisible = ref(false);
const bindingTarget = ref<BindingTarget | null>(null);
const bindingKeyword = ref("");

export function useBindingPicker() {
  function open(target: BindingTarget): void {
    bindingTarget.value = target;
    bindingKeyword.value = "";
    bindingVisible.value = true;
  }
  function close(): void {
    bindingVisible.value = false;
    bindingTarget.value = null;
  }
  return {
    visible: bindingVisible,
    target: bindingTarget,
    keyword: bindingKeyword,
    open,
    close,
  };
}

/* ---------------- 选项录入 ---------------- */

export interface OptionsTarget {
  nodeId: string;
  key: string;
  label: string;
}

const optionsVisible = ref(false);
const optionsTarget = ref<OptionsTarget | null>(null);

export function useOptionsDialog() {
  function open(target: OptionsTarget): void {
    optionsTarget.value = target;
    optionsVisible.value = true;
  }
  function close(): void {
    optionsVisible.value = false;
    optionsTarget.value = null;
  }
  return { visible: optionsVisible, target: optionsTarget, open, close };
}

/* ---------------- 外部数据源 ---------------- */

export interface ExternalTarget {
  nodeId: string;
  label: string;
}

const externalVisible = ref(false);
const externalTarget = ref<ExternalTarget | null>(null);

export function useExternalSourceDialog() {
  function open(target: ExternalTarget): void {
    externalTarget.value = target;
    externalVisible.value = true;
  }
  function close(): void {
    externalVisible.value = false;
    externalTarget.value = null;
  }
  return { visible: externalVisible, target: externalTarget, open, close };
}

/* ---------------- 显示 / 隐藏条件（r5u4Ul） ---------------- */

/** 条件配置的落点：哪个节点的显示条件或隐藏条件 */
export interface ConditionTarget {
  nodeId: string;
  label: string;
  kind: "show" | "hide";
}

const conditionVisible = ref(false);
const conditionTarget = ref<ConditionTarget | null>(null);

export function useConditionDialog() {
  function open(target: ConditionTarget): void {
    conditionTarget.value = target;
    conditionVisible.value = true;
  }
  function close(): void {
    conditionVisible.value = false;
    conditionTarget.value = null;
  }
  return { visible: conditionVisible, target: conditionTarget, open, close };
}

/* ---------------- 子映射（响应目标为子表单时） ---------------- */

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

const subMapVisible = ref(false);
const subMapTarget = ref<SubMapTarget | null>(null);
const subMapResolve = ref<((value: ExternalSubMap[] | null) => void) | null>(null);

export function useSubMapDialog() {
  /**
   * 打开子映射弹窗。返回 Promise，resolve 出用户确认后的子映射；
   * 取消时 resolve null（表示「没改」，调用方保留原配置）。
   */
  function open(target: SubMapTarget): Promise<ExternalSubMap[] | null> {
    subMapTarget.value = target;
    subMapVisible.value = true;
    return new Promise((resolve) => {
      subMapResolve.value = resolve;
    });
  }
  function confirm(value: ExternalSubMap[]): void {
    subMapVisible.value = false;
    subMapResolve.value?.(value);
    subMapResolve.value = null;
  }
  function cancel(): void {
    subMapVisible.value = false;
    subMapResolve.value?.(null);
    subMapResolve.value = null;
  }
  return { visible: subMapVisible, target: subMapTarget, open, confirm, cancel };
}

/* ---------------- 请求头（独立弹窗） ---------------- */

const headersVisible = ref(false);
/**
 * 由外部数据源弹窗持有：打开请求头弹窗时把当前头传进来，关闭时取回。
 * 用行数组而非对象：空名称的行在编辑期间要保留，否则一改别的行它就被挤掉了。
 */
const headersRows = ref<Array<{ key: string; value: string }>>([]);
const headersResolve = ref<((value: Array<{ key: string; value: string }> | null) => void) | null>(null);

export function useHeadersDialog() {
  /**
   * 打开请求头弹窗。返回一个 Promise，resolve 出用户确认后的请求头行；
   * 取消时 resolve null（表示「没改」，调用方须保留原值 ——
   * 不能用空对象表示取消，否则「确认删空」与「取消」无法区分）。
   */
  function open(current: Record<string, string>): Promise<Array<{ key: string; value: string }> | null> {
    headersRows.value = Object.entries(current).map(([key, value]) => ({ key, value }));
    headersVisible.value = true;
    return new Promise((resolve) => {
      headersResolve.value = resolve;
    });
  }
  function confirm(value: Array<{ key: string; value: string }>): void {
    headersVisible.value = false;
    headersResolve.value?.(value);
    headersResolve.value = null;
  }
  function cancel(): void {
    headersVisible.value = false;
    headersResolve.value?.(null);
    headersResolve.value = null;
  }
  return { visible: headersVisible, rows: headersRows, open, confirm, cancel };
}
