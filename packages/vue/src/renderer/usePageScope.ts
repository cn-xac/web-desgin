import { onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import type { PageSchema } from "@x-ac/design-core";
import { setByPath } from "@x-ac/design-core";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

export interface PageScopeApi {
  scope: Record<string, unknown>;
  loading: Ref<boolean>;
  dataError: Ref<string>;
  resetScope: (paths?: string[]) => void;
  reload: () => void;
}

/**
 * 页面作用域：
 *   state 初值 + dataSource 取数结果 → 一个 reactive 对象，渲染器所有表达式都从这个 scope 求值。
 * 只监听 page.id，避免设计器改属性时把用户填的数据冲掉。
 */
export function usePageScope(page: Ref<PageSchema>, enabled: Ref<boolean>): PageScopeApi {
  const initialState = (): Record<string, unknown> => deepClone(page.value.state ?? {});
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
    const config = page.value.dataSource ?? {};
    const entries = Object.entries(config);
    if (!entries.length) return;

    controller?.abort();
    controller = new AbortController();
    loading.value = entries.some(([, item]) => item.type === "http" && item.auto !== false);

    for (const [key, item] of entries) {
      if (item.type === "static") {
        scope[key] = deepClone(item.data);
        continue;
      }
      if (item.type === "http" && item.auto === false) continue;
      if (!item.url) continue;

      try {
        const response = await fetch(item.url, {
          method: item.method ?? "GET",
          signal: controller.signal,
          headers: item.method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: item.method === "POST" ? JSON.stringify(item.params ?? {}) : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        scope[key] = await response.json();
        dataError.value = "";
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        // 取数失败不应白屏：保留 scope 原值，只在控制台与顶部提示
        dataError.value = `数据源 ${key} 加载失败：${(error as Error).message}`;
        console.warn(`[vue-design][datasource] ${key} 加载失败`, error);
      }
    }
    loading.value = false;
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
