<script setup lang="ts">
// 原生动作组件：点击通过 emit("click") 上抛，引擎转成 node-event 只读通知。
defineProps<{ label?: string; type?: "default" | "primary" }>();
const emit = defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button class="nx-btn" :class="`nx-btn--${type ?? 'default'}`" @click="emit('click')">
    {{ label }}
  </button>
</template>
