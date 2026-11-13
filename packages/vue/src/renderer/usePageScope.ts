import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import type { PageSchema } from "@x-ac/web-design-core";
import {
  collectBindableElements,
  collectExternalSources,
  deepClone,
  getByPath,
  loadExternalSource,
  loadExternalSources,
  loadPageData,
  setByPath,
} from "@x-ac/web-design-core";

export interface PageScopeApi {
  scope: Record<string, unknown>;
  loading: Ref<boolean>;
  dataError: Ref<string>;
  resetScope: (paths?: string[]) => void;
  reload: () => void;
}

/**
 * 页面作用域：state 初值 + dataSource 取数 + 外部数据源 → 一个 reactive 对象。
 * 取数逻辑已下沉到 core（loadPageData / loadExternalSources），与 React 侧共用同一份实现；
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
    // 外部数据源（rg4KCt）：结果写进 scope，元素再通过 {{}} 读它
    await loadExternalSources(page.value, scope, {
      signal: controller.signal,
      onError: (message) => {
        if (message) dataError.value = message;
      },
    });
  }

  /* ---------------- 外部数据源：触发长度 ---------------- */

  const externalList = computed(() => collectExternalSources(page.value));

  /** 节点 → 它的绑定路径（用于「用元素自身的值作为触发源」） */
  const elementPaths = computed(() => {
    const map = new Map<string, string>();
    for (const item of collectBindableElements(page.value)) map.set(item.nodeId, item.path);
    return map;
  });

  /** 触发型数据源：输入长度达到阈值才发请求 */
  const triggerSources = computed(() =>
    externalList.value.filter(({ source }) => Number(source.triggerLength ?? 0) > 0),
  );

  const triggerPaths = computed(() =>
    triggerSources.value.map(
      ({ node, source }) => source.triggerPath ?? elementPaths.value.get(node.id) ?? "",
    ),
  );

  /** 同一个值不重复触发：用户每敲一个字都会触发 watcher */
  const lastTriggered = new Map<string, string>();

  watch(
    () => triggerPaths.value.map((path) => (path ? getByPath(scope, path) : undefined)),
    (values) => {
      triggerSources.value.forEach(({ source }, index) => {
        const path = triggerPaths.value[index] ?? "";
        const raw = values[index];
        const threshold = Number(source.triggerLength ?? 0);
        const text = raw === null || raw === undefined ? "" : String(raw);
        if (text.length < threshold) return;
        const key = `${source.url}|${path}|${threshold}`;
        if (lastTriggered.get(key) === text) return;
        lastTriggered.set(key, text);
        void loadExternalSource(source, scope, {
          signal: controller?.signal,
          onError: (message) => {
            if (message) dataError.value = message;
          },
        });
      });
    },
    { deep: true },
  );

  onMounted(() => {
    if (enabled.value) void loadData();
  });

  watch(
    () => page.value.id,
    () => {
      lastTriggered.clear();
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
