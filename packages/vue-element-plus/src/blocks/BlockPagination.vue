<script setup lang="ts">
/**
 * 分页。`page` 是当前页，写进 Schema 的 props 里便于预览时定住页码；
 * 真要联动数据请在页面状态里存页码并用表达式绑定。
 */
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    page?: number;
    pageSize?: number;
    total?: number;
    layout?: string;
    pagerCount?: number;
    background?: boolean;
    small?: boolean;
    disabled?: boolean;
    hideOnSinglePage?: boolean;
  }>(),
  {
    page: 1,
    pageSize: 10,
    total: 120,
    layout: "prev, pager, next",
    pagerCount: 7,
    background: false,
    small: false,
    disabled: false,
    hideOnSinglePage: false,
  },
);

const current = ref(Number(props.page) || 1);
watch(
  () => props.page,
  (next) => (current.value = Number(next) || 1),
);

const size = ref(Number(props.pageSize) || 10);
watch(
  () => props.pageSize,
  (next) => (size.value = Number(next) || 10),
);

const layout = computed(() => props.layout || "prev, pager, next");
</script>

<template>
  <el-pagination
    v-model:current-page="current"
    v-model:page-size="size"
    :total="Number(total) || 0"
    :layout="layout"
    :pager-count="Number(pagerCount) || 7"
    :background="background"
    :small="small"
    :disabled="disabled"
    :hide-on-single-page="hideOnSinglePage"
  />
</template>
