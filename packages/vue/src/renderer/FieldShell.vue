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
/* 下面两组是「可选增强」，不是渲染器的硬依赖：
   装了 Element Plus 时命中它的内部类名，保持该库原生的错误描边与占满宽度；
   换其它 UI 库时这两组静默失效，错误态仍有 .wb-field__error 文案与 var(--wb-danger) 语义色。
   引擎自身不 import element-plus，也不依赖任何库私有类名才能渲染。 */
.wb-field.is-error :deep(.el-input__wrapper),
.wb-field.is-error :deep(.el-textarea__inner),
.wb-field.is-error :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--wb-danger) inset;
}
.wb-field :deep(.el-select),
.wb-field :deep(.el-date-editor),
.wb-field :deep(.el-input-number) {
  width: 100%;
}
</style>
