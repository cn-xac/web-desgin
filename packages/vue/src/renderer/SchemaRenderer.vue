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
import { Fragment, computed, defineComponent, h, inject, markRaw, provide, reactive, ref, toRaw, useAttrs, watch } from "vue";
import type { Component } from "vue";
import type {
  DataExportOptions,
  DataExportResult,
  ExternalVisibility,
  NodeSchema,
  PageSchema,
  UiAdapter,
  UiEventHook,
  UiEventPayload,
} from "@x-ac/web-design-core";
import { exportData, createEmptyPage, MATERIALS, migratePage, validateData, validateNodeField } from "@x-ac/web-design-core";
import SchemaNode from "./SchemaNode.vue";
import { RENDER_CONTEXT, UI_ADAPTER } from "./context";
import { usePageScope } from "./usePageScope";
import { registryForMaterials } from "../materials/catalog";

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
    /**
     * 事件拦截钩子：每个节点事件触发时都会先收到完整 payload
     * （事件名、节点、物料、页面、scope、组件原始参数、原生事件、动作清单）。
     * 返回 false 或调用 payload.preventDefault() 可跳过该事件配置的预设动作。
     */
    onEvent?: UiEventHook;
    /**
     * 外部显隐控制：按节点 id 传入 { visible, force? }。
     * force=true 忽略节点自身条件；否则仅在本地条件均未命中时生效。
     */
    visibility?: ExternalVisibility;
  }>(),
  { mode: "view", design: false },
);

const emit = defineEmits<{
  "update:data": [value: Record<string, unknown>];
  /** submitForm 动作校验通过、数据组装完成时触发 */
  submit: [payload: Record<string, unknown>];
  /** 动作「页面跳转」：与 prop navigate 二选一接，事件更 Vue 化 */
  navigate: [to: string];
  /** 节点事件只读通知：拿到的是同一个 UiEventPayload，不参与控制流 */
  nodeEvent: [payload: UiEventPayload];
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

/**
 * 适配包的外层 Provider（主题 / 语言 / 消息上下文，如 NConfigProvider、
 * a-config-provider、ElConfigProvider）。引擎只认 UiAdapter.provider 这一个契约。
 *
 * 未配置时用 Fragment 承载子节点，不产生额外 DOM：根节点仍是原来的
 * div.wb-renderer，布局、maxWidth 与宿主样式选择器都不受影响。
 */
const ProviderRoot = defineComponent({
  name: "ProviderRoot",
  setup(_props, { slots }) {
    return () => {
      const children = slots.default?.();
      const provider = activeAdapter.value?.provider as Component | undefined;
      // renderless Provider（如 Naive 的 NConfigProvider）不吃 props，只吃 default 插槽
      return provider ? h(provider, null, { default: () => children }) : h(Fragment, null, children);
    };
  },
});

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
/**
 * 根级子节点兜底：畸形 Schema（旧版本残留、手工构造、截断 JSON 等）可能缺 children。
 * 此处与 SchemaNode 的 `node.children ?? []` 保持一致，避免渲染器在入口就崩。
 */
const pageChildren = computed(() => pageRef.value.children ?? []);
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

/**
 * 物料目录：校验与数据导出必须用当前适配包的清单，
 * 否则业务物料（isFormControl: true）会被当成非表单组件，required 之类的规则直接失效。
 */
const catalog = computed(() =>
  registryForMaterials(activeAdapter.value?.materials?.length ? activeAdapter.value.materials : MATERIALS),
);

/** 校验整页数据，错误会直接显示到对应字段下方 */
function validate(): boolean {
  return validateData(pageRef.value, scope, { errors, materials: catalog.value }).valid;
}

/** 单字段校验：失焦时用，避免一次扫描整页 */
function validateField(node: NodeSchema): void {
  validateNodeField(node, scope, errors, catalog.value);
}

/** 收集表单数据（默认顺带校验） */
function getData(options?: DataExportOptions): DataExportResult {
  return exportData(pageRef.value, scope, { ...options, materials: catalog.value });
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
  notifyEvent: (payload) => emit("nodeEvent", payload),
  // getter：宿主后续替换 onEvent / visibility 时，子树无需重建即可生效
  get onEvent() {
    return props.onEvent;
  },
  get visibility() {
    return props.visibility;
  },
});

const deviceWidth = computed(() => {
  const device = pageRef.value.meta?.device ?? "pc";
  if (device === "h5") return 420;
  if (device === "pad") return 768;
  return 960;
});
</script>

<template>
  <ProviderRoot>
    <div class="wb-renderer" :class="[`wb-renderer--${mode}`, { 'is-loading': loading }]" :style="{ maxWidth: `${deviceWidth}px` }">
      <div v-if="parseError" class="wb-renderer__alert">{{ parseError }}</div>
      <div v-else-if="dataError" class="wb-renderer__alert">{{ dataError }}</div>

      <template v-if="pageChildren.length">
        <SchemaNode
          v-for="node in pageChildren"
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
  </ProviderRoot>
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
