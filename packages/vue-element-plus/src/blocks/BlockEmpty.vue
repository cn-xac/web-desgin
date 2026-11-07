<script setup lang="ts">
/**
 * 空状态。`imageSize` 用数字时按 px 处理。
 * 不支持自定义图片（需要传组件），低代码里换图用 image 物料更直接。
 */
withDefaults(
  defineProps<{
    description?: string;
    imageSize?: number;
  }>(),
  { description: "暂无数据", imageSize: 100 },
);
</script>

<template>
  <el-empty :description="description" :image-size="Number(imageSize) || 100" />
</template>
