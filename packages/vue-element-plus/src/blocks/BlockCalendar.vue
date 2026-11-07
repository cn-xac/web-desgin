<script setup lang="ts">
/**
 * 日历。纯展示：`date` 决定展示哪个月，交互（翻月、选中）由 EP 自己处理。
 * 需要把选中日期收进数据请用日期选择物料。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    date?: string;
  }>(),
  { date: "" },
);

/** 传空串时用今天，避免 ElCalendar 收到空值报错 */
const value = computed(() => {
  const raw = props.date?.trim();
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
});
</script>

<template>
  <el-calendar :model-value="value" />
</template>
