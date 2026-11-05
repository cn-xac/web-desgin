<script setup lang="ts">
/**
 * 渲染入口。生产环境的 /preview 只加载这一个组件树，不引入设计器。
 */
import { computed, provide, reactive } from "vue";
import type { DataExportOptions, DataExportResult, NodeSchema, PageSchema } from "@x-ac/design-core";
import { exportData, validateData, validateNodeField } from "@x-ac/design-core";
import SchemaNode from "./SchemaNode.vue";
import { RENDER_CONTEXT } from "./context";
import { usePageScope } from "./usePageScope";

const props = withDefaults(
  defineProps<{
    page: PageSchema;
    mode?: "view" | "edit";
    design?: boolean;
    navigate?: (to: string) => void;
  }>(),
  { mode: "view", design: false },
);

const pageRef = computed(() => props.page);
const dataEnabled = computed(() => props.mode === "view");
const { scope, loading, dataError, resetScope } = usePageScope(pageRef, dataEnabled);

const errors = reactive<Record<string, string>>({});

/* ---------------- 对宿主的命令式 API ---------------- */

/** 校验整页数据，错误会直接显示到对应字段下方 */
function validate(): boolean {
  return validateData(props.page, scope, { errors }).valid;
}

/** 单字段校验：失焦时用，避免一次扫描整页 */
function validateField(node: NodeSchema): void {
  validateNodeField(node, scope, errors);
}

/** 收集表单数据（默认顺带校验） */
function getData(options?: DataExportOptions): DataExportResult {
  return exportData(props.page, scope, options);
}

function getErrors(): Record<string, string> {
  return { ...errors };
}

function reset(): void {
  resetScope();
  Object.keys(errors).forEach((key) => delete errors[key]);
}

defineExpose({ scope, validate, validateField, getData, exportData: getData, getErrors, reset });

provide(RENDER_CONTEXT, {
  get page() {
    return props.page;
  },
  errors,
  resetScope,
  validateField,
  navigate: (to: string) => {
    if (props.navigate) props.navigate(to);
    else console.warn(`[vue-design] 未提供跳转能力：${to}`);
  },
});

const deviceWidth = computed(() => {
  const device = props.page.meta?.device ?? "pc";
  if (device === "h5") return 420;
  if (device === "pad") return 768;
  return 960;
});
</script>

<template>
  <div class="wb-renderer" :class="[`wb-renderer--${mode}`, { 'is-loading': loading }]" :style="{ maxWidth: `${deviceWidth}px` }">
    <div v-if="dataError" class="wb-renderer__alert">{{ dataError }}</div>

    <template v-if="page.children.length">
      <SchemaNode
        v-for="node in page.children"
        :key="node.id"
        :node="node"
        :scope="scope"
        :mode="mode"
        :design="design"
      />
    </template>

    <div v-else class="wb-renderer__empty">
      <template v-if="design">
        <div class="wb-renderer__empty-title">画布还是空的</div>
        <div class="wb-renderer__empty-tip">从左侧拖入组件，或点击组件直接添加</div>
      </template>
      <template v-else>
        <div class="wb-renderer__empty-title">页面暂无内容</div>
        <div class="wb-renderer__empty-tip">该页面的 Schema 中没有可渲染节点</div>
      </template>
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
