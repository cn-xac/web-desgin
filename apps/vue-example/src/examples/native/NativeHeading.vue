<script setup lang="ts">
// 原生展示组件：零 UI 库依赖，仅用原生标签。组件实现 + 元数据由 materials.ts 注册。
defineProps<{ text?: string; level?: 1 | 2 | 3 }>();
</script>

<template>
  <component :is="`h${level ?? 2}`" class="nx-heading">{{ text }}</component>
</template>
