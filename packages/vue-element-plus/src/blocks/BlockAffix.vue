<script setup lang="ts">
/**
 * 固钉。设计态与运行时行为一致：滚动到阈值后吸顶。
 * `target` 需要 DOM 选择器，低代码里配置价值低，故不暴露。
 */
withDefaults(
  defineProps<{
    offset?: number;
    position?: "top" | "bottom";
  }>(),
  { offset: 0, position: "top" },
);
</script>

<template>
  <el-affix :offset="Number(offset) || 0" :position="position">
    <slot />
  </el-affix>
</template>
