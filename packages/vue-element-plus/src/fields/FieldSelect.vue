<script setup lang="ts">
import { computed } from "vue";
import { parseOptions } from "@x-ac/design-core";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: unknown;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
  }>(),
  { placeholder: "请选择", clearable: true, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const items = computed(() => parseOptions(props.options));
</script>

<template>
  <el-select
    :model-value="modelValue as never"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <el-option v-for="item in items" :key="item.value" :label="item.label" :value="item.value" />
  </el-select>
</template>
