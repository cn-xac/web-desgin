<script setup lang="ts">
/**
 * Element Plus 适配包 · 设计器下拉。
 * 引擎给的是 options 数组，Element Plus 需要 el-option 子节点，差异在这里抹平。
 */
interface SelectOption {
  label: string;
  value: string | number;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    options?: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    size?: "small" | "default";
    clearable?: boolean;
  }>(),
  { modelValue: "", options: () => [], placeholder: "", disabled: false, size: "small", clearable: false },
);

const emit = defineEmits<{ "update:modelValue": [string | number]; change: [string | number] }>();

function onUpdate(value: string | number | undefined): void {
  emit("update:modelValue", value ?? "");
  emit("change", value ?? "");
}
</script>

<template>
  <el-select
    :model-value="props.modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :size="size"
    :clearable="clearable"
    @update:model-value="onUpdate"
  >
    <el-option v-for="option in options" :key="String(option.value)" :label="option.label" :value="option.value" />
  </el-select>
</template>
