<script setup lang="ts">
/**
 * 标签输入。值是一个字符串数组，`max` 限制标签个数。
 */
withDefaults(
  defineProps<{
    modelValue?: unknown;
    placeholder?: string;
    max?: number;
    maxlength?: number;
    clearable?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    tagType?: "primary" | "success" | "warning" | "danger" | "info";
    tagEffect?: "dark" | "light" | "plain";
    collapseTags?: boolean;
    delimiter?: string;
  }>(),
  {
    placeholder: "输入后回车",
    max: 0,
    maxlength: 0,
    clearable: true,
    disabled: false,
    readonly: false,
    tagType: "info",
    tagEffect: "light",
    collapseTags: false,
    delimiter: "",
  },
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
  <el-input-tag
    :model-value="(Array.isArray(modelValue) ? modelValue : []) as never"
    :placeholder="placeholder"
    :max="Number(max) || undefined"
    :maxlength="Number(maxlength) || undefined"
    :clearable="clearable"
    :disabled="disabled"
    :readonly="readonly"
    :tag-type="tagType"
    :tag-effect="tagEffect"
    :collapse-tags="collapseTags"
    :delimiter="delimiter || undefined"
    @update:model-value="onChange"
  />
</template>
