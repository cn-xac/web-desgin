<script setup lang="ts">
/**
 * 多选框组。`min` / `max` 是 EP 的勾选数量约束，不是数据校验 ——
 * 数据校验走物料属性里的「必填 / 最少选 N 项」规则。
 */
import { computed } from "vue";
import { parseOptions } from "@x-ac/design-core";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: unknown;
    disabled?: boolean;
    size?: "large" | "default" | "small";
    variant?: "default" | "button";
    border?: boolean;
    min?: number;
    max?: number;
    textColor?: string;
    fill?: string;
  }>(),
  { disabled: false, size: "default", variant: "default", border: false, min: 0, max: 0, textColor: "", fill: "" },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const items = computed(() => parseOptions(props.options));

const selected = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as unknown[]) : []));

function onChange(value: unknown): void {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-checkbox-group
    :model-value="selected"
    :disabled="disabled"
    :size="size"
    :min="Number(min) || undefined"
    :max="Number(max) || undefined"
    :text-color="textColor || undefined"
    :fill="fill || undefined"
    @update:model-value="onChange"
  >
    <template v-if="variant === 'button'">
      <el-checkbox-button v-for="item in items" :key="String(item.value)" :value="item.value">
        {{ item.label }}
      </el-checkbox-button>
    </template>
    <template v-else>
      <el-checkbox
        v-for="item in items"
        :key="String(item.value)"
        :value="item.value"
        :border="border"
        :size="size"
      >
        {{ item.label }}
      </el-checkbox>
    </template>
  </el-checkbox-group>
</template>
