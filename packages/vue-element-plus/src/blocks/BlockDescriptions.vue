<script setup lang="ts">
/**
 * 描述列表。每项写成「标签:值」，与 css 描述列表的心智一致。
 */
import { computed } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    title?: string;
    extra?: string;
    column?: number;
    border?: boolean;
    direction?: "horizontal" | "vertical";
    size?: "large" | "default" | "small";
  }>(),
  { items: "姓名:张三,部门:技术中心,状态:在职", title: "", extra: "", column: 3, border: true, direction: "horizontal", size: "default" },
);

const list = computed(() => parsePairs(props.items));

/** ElDescriptions 的 column 超过 4 会挤成两字一行，上限按官方建议夹到 4 */
const columns = computed(() => Math.min(4, Math.max(1, Number(props.column) || 3)));
</script>

<template>
  <el-descriptions :title="title || undefined" :column="columns" :border="border" :direction="direction" :size="size">
    <template v-if="extra" #extra>{{ extra }}</template>
    <el-descriptions-item v-for="(item, index) in list" :key="index" :label="item.label">
      {{ item.value }}
    </el-descriptions-item>
  </el-descriptions>
</template>
