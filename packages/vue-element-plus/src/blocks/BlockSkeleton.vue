<script setup lang="ts">
/**
 * 骨架屏。`loading` 为 false 时才显示默认插槽内容 —— 设计器里通常保持 true，
 * 用来占位预览接口返回前的布局。
 */
withDefaults(
  defineProps<{
    rows?: number;
    animated?: boolean;
    loading?: boolean;
    throttle?: number;
  }>(),
  { rows: 3, animated: false, loading: true, throttle: 0 },
);
</script>

<template>
  <el-skeleton :rows="Number(rows) || 3" :animated="animated" :loading="loading" :throttle="Number(throttle) || 0">
    <template #default><slot /></template>
  </el-skeleton>
</template>
