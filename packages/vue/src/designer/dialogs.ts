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

/* ---------------- 请求头（独立弹窗） ---------------- */

const headersVisible = ref(false);
/** 由外部数据源弹窗持有：打开请求头弹窗时把当前头传进来，关闭时取回 */
const headersDraft = ref<Record<string, string>>({});
const headersResolve = ref<((value: Record<string, string>) => void) | null>(null);

export function useHeadersDialog() {
  /**
   * 打开请求头弹窗。返回一个 Promise，resolve 出用户确认后的请求头；
   * 取消时 resolve 空对象（调用方据此判断是否覆盖）。
   */
  function open(current: Record<string, string>): Promise<Record<string, string>> {
    headersDraft.value = { ...current };
    headersVisible.value = true;
    return new Promise((resolve) => {
      headersResolve.value = resolve;
    });
  }
  function confirm(value: Record<string, string>): void {
    headersVisible.value = false;
    headersResolve.value?.(value);
    headersResolve.value = null;
  }
  function cancel(): void {
    headersVisible.value = false;
    headersResolve.value?.({});
    headersResolve.value = null;
  }
  return { visible: headersVisible, draft: headersDraft, open, confirm, cancel };
}
