<script setup lang="ts">
/**
 * 单选框组。`variant` 决定用原生圆点还是按钮样式（EP 的 radio-button）。
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
    textColor?: string;
    fill?: string;
  }>(),
  { disabled: false, size: "default", variant: "default", border: false, textColor: "", fill: "" },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const items = computed(() => parseOptions(props.options));

function onChange(value: unknown): void {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-radio-group
    :model-value="modelValue as never"
    :disabled="disabled"
    :size="size"
    :text-color="textColor || undefined"
    :fill="fill || undefined"
    @update:model-value="onChange"
  >
    <template v-if="variant === 'button'">
      <el-radio-button v-for="item in items" :key="String(item.value)" :value="item.value">
        {{ item.label }}
      </el-radio-button>
    </template>
    <template v-else>
      <el-radio
        v-for="item in items"
        :key="String(item.value)"
        :value="item.value"
        :border="border"
        :size="size"
      >
        {{ item.label }}
      </el-radio>
    </template>
  </el-radio-group>
</template>
