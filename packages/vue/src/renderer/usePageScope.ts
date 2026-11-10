import { onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import type { PageSchema } from "@x-ac/web-design-core";
import { deepClone, loadPageData, setByPath } from "@x-ac/web-design-core";

export interface PageScopeApi {
  scope: Record<string, unknown>;
  loading: Ref<boolean>;
  dataError: Ref<string>;
  resetScope: (paths?: string[]) => void;
  reload: () => void;
}

/**
 * 页面作用域：state 初值 + dataSource 取数结果 → 一个 reactive 对象。
 * 取数逻辑已下沉到 core（loadPageData），与 React 侧共用同一份实现；
 * 这里只负责 Vue 生命周期、AbortController 与响应式状态。
 *
 * seed：宿主通过 v-model:data 传入的外部数据，优先级高于 page.state。
 */
export function usePageScope(
  page: Ref<PageSchema>,
  enabled: Ref<boolean>,
  seed?: () => Record<string, unknown> | undefined,
): PageScopeApi {
  const initialState = (): Record<string, unknown> => {
    const external = seed?.();
    return deepClone(external && Object.keys(external).length ? external : page.value.state ?? {});
  };
  const scope = reactive<Record<string, unknown>>(initialState());
  const loading = ref(false);
  const dataError = ref("");
  let controller: AbortController | null = null;

  function resetScope(paths?: string[]): void {
    if (paths?.length) {
      const base = initialState();
      paths.forEach((path) => setByPath(scope, path, base[path]));
      return;
    }
    const base = initialState();
    Object.keys(scope).forEach((key) => delete scope[key]);
    Object.assign(scope, base);
    // 设计态不需要真取数，避免编辑时打接口
    if (enabled.value) void loadData();
  }

  async function loadData(): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    await loadPageData(page.value, scope, {
      signal: controller.signal,
      onLoading: (value) => {
        loading.value = value;
      },
      onError: (message) => {
        dataError.value = message;
      },
    });
  }

  onMounted(() => {
    if (enabled.value) void loadData();
  });

  watch(
    () => page.value.id,
    () => {
      resetScope();
    },
  );

  // 设计器里改 state 初值后，画布上的数据要跟着刷新（id 不变的情况）
  watch(
    () => JSON.stringify(page.value.state ?? {}),
    () => resetScope(),
  );

  onBeforeUnmount(() => controller?.abort());

  return { scope, loading, dataError, resetScope, reload: loadData };
}
