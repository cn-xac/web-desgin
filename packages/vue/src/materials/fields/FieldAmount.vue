<script setup lang="ts">
/**
 * 业务组件示例：金额输入。千分位展示 + 精度控制 + 货币前缀。
 */
withDefaults(
  defineProps<{
    modelValue?: unknown;
    placeholder?: string;
    precision?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
  }>(),
  { placeholder: "请输入金额", precision: 2, min: 0, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

function format(value: string | number): string {
  const text = String(value ?? "");
  if (!text) return "";
  const [int, dec] = text.split(".");
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${withComma}.${dec}` : withComma;
}

function parse(value: string): string {
  return value.replace(/[^\d.-]/g, "");
}
</script>

<template>
  <el-input-number
    :model-value="modelValue as never"
    :placeholder="placeholder"
    :precision="precision"
    :min="min"
    :max="max"
    :disabled="disabled"
    :formatter="format"
    :parser="parse"
    controls-position="right"
    style="width: 100%"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <template #prefix>¥</template>
  </el-input-number>
</template>
