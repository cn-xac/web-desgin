<script setup lang="ts">
/**
 * 绑定前缀作用域：把给定的绑定前缀注入子树。
 * 子表单每组渲染子字段时，用它的组路径（form.items[i]）作为前缀，
 * 让组内表单控件按「前缀.组件ID」自动落到正确的明细位置。
 */
import { provide } from "vue";
import { BINDING_BASE } from "./context";

const props = defineProps<{ base: string }>();
provide(BINDING_BASE, props.base);
</script>

<template>
  <slot />
</template>
