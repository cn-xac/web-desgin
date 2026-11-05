<script setup lang="ts">
import { computed } from "vue";
import { parseOptions } from "@x-ac/design-core";

const props = defineProps<{
  modelValue?: unknown;
  options?: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const items = computed(() => parseOptions(props.options));

const selected = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as unknown[]) : []));
</script>

<template>
  <el-checkbox-group
    :model-value="selected"
    :disabled="disabled"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <el-checkbox v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</el-checkbox>
  </el-checkbox-group>
</template>
