<script setup lang="ts">
/**
 * Element Plus 适配包 · 设计器按钮。
 * 把引擎的归一化语义（default / primary / danger / text）翻成 Element Plus 的属性组合。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    type?: "default" | "primary" | "danger" | "text";
    size?: "small" | "default";
    disabled?: boolean;
  }>(),
  { type: "default", size: "small", disabled: false },
);

const elType = computed(() => (props.type === "text" ? "primary" : props.type === "default" ? "" : props.type));
</script>

<template>
  <el-button :type="elType" :size="size" :text="type === 'text'" :disabled="disabled">
    <slot />
  </el-button>
</template>
