<script setup lang="ts">
/**
 * 验证码输入。`length` 决定格子数，`mask` 把字符显示成圆点。
 */
withDefaults(
  defineProps<{
    modelValue?: unknown;
    length?: number;
    type?: "outlined" | "filled" | "underlined";
    size?: "large" | "default" | "small";
    mask?: boolean;
    disabled?: boolean;
  }>(),
  { length: 6, type: "outlined", size: "default", mask: false, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

function onChange(value: unknown): void {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-input-otp
    :model-value="String(modelValue ?? '')"
    :length="Number(length) || 6"
    :type="type"
    :size="size"
    :mask="mask"
    :disabled="disabled"
    @update:model-value="onChange"
  />
</template>
