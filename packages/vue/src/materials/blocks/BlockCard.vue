<script setup lang="ts">
defineProps<{
  title?: string;
  shadow?: "always" | "hover" | "never";
}>();
</script>

<template>
  <el-card class="wb-card" :shadow="shadow ?? 'never'">
    <template v-if="title" #header>
      <span class="wb-card__title">{{ title }}</span>
    </template>
    <slot />
  </el-card>
</template>

<style scoped>
.wb-card {
  border-radius: 8px;
  border-color: var(--wb-line);
}
.wb-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom-color: var(--wb-line);
  background: linear-gradient(180deg, #fbfcff, #fff);
}
.wb-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-ink);
  letter-spacing: 0.01em;
}
.wb-card :deep(.el-card__body) {
  padding: 16px;
}
</style>
