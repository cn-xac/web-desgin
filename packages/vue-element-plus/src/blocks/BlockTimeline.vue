<script setup lang="ts">
/**
 * 时间线。每项写成「时间:内容」；只写一项时按纯内容处理。
 */
import { computed } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    reverse?: boolean;
  }>(),
  { items: "2026-11-01:提交申请,2026-11-03:部门审批,2026-11-05:归档", reverse: false },
);

const list = computed(() => parsePairs(props.items));
</script>

<template>
  <el-timeline :reverse="reverse">
    <el-timeline-item
      v-for="(item, index) in list"
      :key="index"
      :timestamp="item.value ? item.label : ''"
      placement="top"
    >
      <span class="wb-timeline__text">{{ item.value || item.label }}</span>
    </el-timeline-item>
  </el-timeline>
</template>

<style scoped>
.wb-timeline__text {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
