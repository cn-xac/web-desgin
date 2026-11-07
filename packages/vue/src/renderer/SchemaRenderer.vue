<script setup lang="ts">
/**
 * 渲染入口（生产可用的页面标签）。
 *
 * ```vue
 * <SchemaPage
 *   :page="schema"            <!-- 页面对象，或直接给 JSON 字符串 -->
 *   v-model:data="formData"   <!-- 表单数据双向同步 -->
 *   @submit="onSubmit"        <!-- submitForm 动作提交成功时抛出数据行 -->
 *   @navigate="onNavigate"    <!-- 动作「页面跳转」 -->
 * />
 * ```
 *
 * 生产环境的 /preview 只加载这一个组件树，不引入设计器。
 * SchemaPage 是本组件的语义化别名，二者完全等同。
 */
import { computed, inject, markRaw, provide, reactive, ref, toRaw, useAttrs, watch } from "vue";
import type { DataExportOptions, DataExportResult, NodeSchema, PageSchema, UiAdapter } from "@x-ac/design-core";
import { exportData, createEmptyPage, migratePage, validateData, validateNodeField } from "@x-ac/design-core";
import SchemaNode from "./SchemaNode.vue";
import { RENDER_CONTEXT, UI_ADAPTER } from "./context";
import { usePageScope } from "./usePageScope";

const props = withDefaults(
  defineProps<{
    /** 页面 Schema；传字符串则按 JSON 解析并自动迁移旧版本 */
    page: PageSchema | string;
    mode?: "view" | "edit";
    design?: boolean;
    /** 页面跳转（prop 形式，兼容旧集成） */
    navigate?: (to: string) => void;
    /** v-model:data —— 宿主外部数据，优先于 page.state 作为初始 scope */
    data?: Record<string, unknown>;
    /**
     * UI 适配包：组件实现 + 双向绑定通道 + 动作副作用。
     * 通常由 createVueDesign({ adapter }) 全局注入；此处是组件级覆盖。
     */
    adapter?: UiAdapter<unknown>;
  }>(),
  { mode: "view", design: false },
);

const emit = defineEmits<{
  "update:data": [value: Record<string, unknown>];
  /** submitForm 动作校验通过、数据组装完成时触发 */
  submit: [payload: Record<string, unknown>];
  /** 动作「页面跳转」：与 prop navigate 二选一接，事件更 Vue 化 */
  navigate: [to: string];
}>();

const attrs = useAttrs();

/* ---------------- UI 适配包：prop 覆盖 > 全局注入 ---------------- */

const inheritedAdapter = inject(UI_ADAPTER, null);
/**
 * 适配包是应用级单例，必须原样透出：
 * - toRaw：宿主通过 props 传进来时可能已被 reactive 包一层（computed / 表单式状态都常见）；
 * - markRaw：computed 对对象返回值会自动 toReactive，不标记的话 components 里的组件对象
 *   也会被代理，渲染时 Vue 会告警「component made a reactive object」并产生无谓开销。
 */
const activeAdapter = computed(() => {
  const adapter = props.adapter ?? inheritedAdapter ?? null;
  return adapter ? (markRaw(toRaw(adapter)) as UiAdapter<unknown>) : null;
});
provide(UI_ADAPTER, activeAdapter.value);

if (!activeAdapter.value) {
  console.warn("[vue-design] 未注入 UI 适配包：所有物料将降级为未知组件占位（不白屏）");
}

/* ---------------- page 归一：对象直用，字符串走解析 + 迁移 ---------------- */

const parseError = ref("");

const resolved = computed<PageSchema>(() => {
  if (typeof props.page !== "string") return props.page;
  try {
    const { schema } = migratePage(props.page);
    parseError.value = "";
    return schema;
  } catch (error) {
    parseError.value = `页面 JSON 解析失败：${(error as Error).message}`;
    return createEmptyPage();
  }
});

const pageRef = resolved;
const dataEnabled = computed(() => props.mode === "view");
const { scope, loading, dataError, resetScope } = usePageScope(pageRef, dataEnabled, () => props.data);

const errors = reactive<Record<string, string>>({});

/* ---------------- v-model:data：scope → 宿主 ---------------- */

/** 上一轮 emit 出去的快照（JSON 串），用于识别「宿主原样回传」避免回环 */
let lastEmitted = "";
let applyingExternal = false;

watch(
  scope,
  () => {
    if (applyingExternal) return;
    const snapshot = JSON.parse(JSON.stringify(scope)) as Record<string, unknown>;
    lastEmitted = JSON.stringify(snapshot);
    emit("update:data", snapshot);
  },
  { deep: true },
);

/* ---------------- v-model:data：宿主 → scope ---------------- */

watch(
  () => props.data,
  (next) => {
    if (!next) return;
    // 宿主把刚 emit 的值原样绑定回来（v-model 的正常回写）：忽略
    if (JSON.stringify(next) === lastEmitted) return;
    // 外部真实变更：整体替换 scope，抑制由此触发的回环 emit
    applyingExternal = true;
    Object.keys(scope).forEach((key) => delete scope[key]);
    Object.assign(scope, JSON.parse(JSON.stringify(next)) as Record<string, unknown>);
    void Promise.resolve().then(() => {
      applyingExternal = false;
    });
  },
  { deep: false },
);

/* ---------------- 对宿主的命令式 API ---------------- */

/** 校验整页数据，错误会直接显示到对应字段下方 */
function validate(): boolean {
  return validateData(pageRef.value, scope, { errors }).valid;
}

/** 单字段校验：失焦时用，避免一次扫描整页 */
function validateField(node: NodeSchema): void {
  validateNodeField(node, scope, errors);
}

/** 收集表单数据（默认顺带校验） */
function getData(options?: DataExportOptions): DataExportResult {
  return exportData(pageRef.value, scope, options);
}

function getErrors(): Record<string, string> {
  return { ...errors };
}

function reset(): void {
  resetScope();
  Object.keys(errors).forEach((key) => delete errors[key]);
}

/** 宿主主动灌数据（区别于 v-model 的另一种显式通道） */
function setData(patch: Record<string, unknown>): void {
  Object.assign(scope, JSON.parse(JSON.stringify(patch)) as Record<string, unknown>);
}

defineExpose({ scope, validate, validateField, getData, exportData: getData, getErrors, reset, setData });

provide(RENDER_CONTEXT, {
  get page() {
    return pageRef.value;
  },
  errors,
  resetScope,
  validateField,
  navigate: (to: string) => {
    emit("navigate", to);
    if (props.navigate) props.navigate(to);
    else if (!("onNavigate" in attrs)) console.warn(`[vue-design] 未提供跳转能力：${to}`);
  },
  onFormSubmit: (payload) => emit("submit", payload),
});

const deviceWidth = computed(() => {
  const device = pageRef.value.meta?.device ?? "pc";
  if (device === "h5") return 420;
  if (device === "pad") return 768;
  return 960;
});
</script>

<template>
  <div class="wb-renderer" :class="[`wb-renderer--${mode}`, { 'is-loading': loading }]" :style="{ maxWidth: `${deviceWidth}px` }">
    <div v-if="parseError" class="wb-renderer__alert">{{ parseError }}</div>
    <div v-else-if="dataError" class="wb-renderer__alert">{{ dataError }}</div>

    <template v-if="pageRef.children.length">
      <SchemaNode
        v-for="node in pageRef.children"
        :key="node.id"
        :node="node"
        :scope="scope"
        :mode="mode"
        :design="design"
      />
    </template>

    <div v-else class="wb-renderer__empty">
      <slot name="empty">
        <template v-if="design">
          <div class="wb-renderer__empty-title">画布还是空的</div>
          <div class="wb-renderer__empty-tip">从左侧拖入组件，或点击组件直接添加</div>
        </template>
        <template v-else>
          <div class="wb-renderer__empty-title">页面暂无内容</div>
          <div class="wb-renderer__empty-tip">该页面的 Schema 中没有可渲染节点</div>
        </template>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.wb-renderer {
  width: 100%;
  margin: 0 auto;
}
.wb-renderer--edit {
  min-height: 240px;
}
.wb-renderer__empty {
  padding: 64px 16px;
  text-align: center;
}
.wb-renderer__empty-title {
  font-size: 14px;
  color: var(--wb-ink3);
}
.wb-renderer__empty-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #b6bdcb;
}
.wb-renderer__alert {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fef0f0;
  color: #f56c6c;
  font-size: 12px;
}
</style>
