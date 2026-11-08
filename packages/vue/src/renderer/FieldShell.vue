<script setup lang="ts">
defineProps<{
  label?: string;
  required?: boolean;
  error?: string;
  tip?: string;
}>();
</script>

<template>
  <div class="wb-field" :class="{ 'is-error': Boolean(error) }">
    <label v-if="label" class="wb-field__label">
      {{ label }}<span v-if="required" class="wb-field__req">*</span>
    </label>
    <div class="wb-field__control">
      <slot />
    </div>
    <div v-if="error" class="wb-field__error">{{ error }}</div>
    <div v-else-if="tip" class="wb-field__tip">{{ tip }}</div>
  </div>
</template>

<style scoped>
.wb-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.wb-field__label {
  font-size: 13px;
  color: var(--wb-ink2);
  line-height: 20px;
}
.wb-field__req {
  color: var(--wb-danger);
  margin-left: 3px;
}
.wb-field__control {
  min-width: 0;
}
.wb-field__error {
  font-size: 12px;
  color: var(--wb-danger);
  line-height: 16px;
}
.wb-field__tip {
  font-size: 12px;
  color: var(--wb-ink3);
  line-height: 16px;
}
</style>
