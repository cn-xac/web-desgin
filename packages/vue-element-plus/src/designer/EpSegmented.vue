<script setup lang="ts">
/**
 * Element Plus 适配包 · 设计器分段控件。
 * 引擎侧是 options 数组，Element Plus 用 radio-group + radio-button 表达。
 */
interface SegmentOption {
  label: string;
  value: string | number;
}

withDefaults(
  defineProps<{
    modelValue?: string | number;
    options?: SegmentOption[];
  }>(),
  { modelValue: "", options: () => [] },
);

const emit = defineEmits<{ "update:modelValue": [string | number]; change: [string | number] }>();

function onUpdate(value: string | number | boolean | undefined): void {
  if (typeof value === "boolean" || value === undefined) return;
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-radio-group :model-value="modelValue" size="small" @update:model-value="onUpdate">
    <el-radio-button v-for="option in options" :key="String(option.value)" :value="option.value">
      {{ option.label }}
    </el-radio-button>
  </el-radio-group>
</template>
