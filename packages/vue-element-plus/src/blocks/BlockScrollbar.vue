<script setup lang="ts">
/**
 * 自定义滚动区域。`height` 为空时由内容撑开，适合卡片内固定高度列表。
 */
withDefaults(
  defineProps<{
    height?: string | number;
    maxHeight?: string | number;
    always?: boolean;
    native?: boolean;
  }>(),
  { height: "", maxHeight: "", always: false, native: false },
);

/** ElScrollbar 对纯数字会当 px 处理，但要避免把空串传成 0 */
function size(value: string | number | undefined): string | number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  return value;
}
</script>

<template>
  <el-scrollbar :height="size(height)" :max-height="size(maxHeight)" :always="always" :native="native">
    <slot />
  </el-scrollbar>
</template>
