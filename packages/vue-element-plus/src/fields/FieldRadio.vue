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
</script>

<template>
  <el-radio-group
    :model-value="modelValue as never"
    :disabled="disabled"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <el-radio v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
  </el-radio-group>
</template>
