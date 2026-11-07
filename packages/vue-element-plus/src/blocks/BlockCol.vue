<script setup lang="ts">
/**
 * 栅格列。断点属性收敛成三种写法：
 * - span/offset：所有屏幕通用
 * - sm/md：小屏与中屏覆盖（`0` 表示该断点不占位）
 * 低代码场景很少需要 xs/xl/xxl 全断点，给常用的三个足够，
 * 面板里也不会出现六个数字输入框。
 */
withDefaults(
  defineProps<{
    span?: number;
    offset?: number;
    sm?: number;
    md?: number;
  }>(),
  { span: 12, offset: 0, sm: 0, md: 0 },
);
</script>

<template>
  <el-col
    :span="Number(span) || 0"
    :offset="Number(offset) || 0"
    :sm="Number(sm) ? Number(sm) : undefined"
    :md="Number(md) ? Number(md) : undefined"
  >
    <slot />
  </el-col>
</template>
