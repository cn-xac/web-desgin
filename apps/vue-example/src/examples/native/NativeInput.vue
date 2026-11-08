<script setup lang="ts">
// 原生受控输入：遵循 Vue 默认绑定通道 modelValue / update:modelValue。
// 引擎把 Schema 里的 modelValue: "{{name}}" 表达式解析后，通过这两个通道与页面数据双向同步。
const props = defineProps<{ modelValue?: string; placeholder?: string }>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}>();

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}
function onChange(e: Event) {
  emit("change", (e.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    class="nx-input"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    @input="onInput"
    @change="onChange"
  />
</template>
