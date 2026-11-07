<script setup lang="ts">
/**
 * 统计数值。`value` 支持绑定表达式（如 {{total}}），
 * 渲染器在 props 层求值后传进来，这里只负责格式化。
 */
withDefaults(
  defineProps<{
    title?: string;
    value?: string | number;
    precision?: number;
    prefix?: string;
    suffix?: string;
    groupSeparator?: string;
  }>(),
  { title: "累计用户", value: 12345, precision: 0, prefix: "", suffix: "", groupSeparator: "," },
);
</script>

<template>
  <el-statistic
    :title="title"
    :value="value"
    :precision="Number(precision) || 0"
    :prefix="prefix || undefined"
    :suffix="suffix || undefined"
    :group-separator="groupSeparator"
  />
</template>
