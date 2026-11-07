<script setup lang="ts">
/**
 * 结果页。`icon` 是 EP 内置的四种状态图标（success / warning / info / error）。
 */
withDefaults(
  defineProps<{
    title?: string;
    subTitle?: string;
    icon?: "success" | "warning" | "info" | "error";
  }>(),
  { title: "操作成功", subTitle: "内容将在此处显示", icon: "success" },
);
</script>

<template>
  <el-result :icon="icon" :title="title" :sub-title="subTitle" />
</template>
