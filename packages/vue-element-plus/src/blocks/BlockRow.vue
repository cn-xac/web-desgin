<script setup lang="ts">
/**
 * 栅格行。ElRow 本身没有业务属性，只做布局，
 * 所以不做任何 props 转换，直接透传给 ElRow。
 */
withDefaults(
  defineProps<{
    gutter?: number;
    justify?: "start" | "end" | "center" | "space-around" | "space-between" | "space-evenly";
    align?: "top" | "middle" | "bottom";
    wrap?: boolean;
  }>(),
  { gutter: 0, justify: "start", align: "top", wrap: true },
);
</script>

<template>
  <el-row :gutter="Number(gutter) || 0" :justify="justify" :align="align" :wrap="wrap">
    <slot />
  </el-row>
</template>
