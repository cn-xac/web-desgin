<script setup lang="ts">
/**
 * 通用弹窗外壳。
 *
 * 设计器不绑定任何 UI 库（换 Element Plus / antd 都不该改引擎），
 * 所以弹窗自己用原生 DOM 实现：遮罩 + 面板 + ESC 关闭。
 * 需要 UI 库观感一致的适配包可以自行覆盖这三个弹窗组件。
 */
import { onBeforeUnmount, onMounted } from "vue";

withDefaults(defineProps<{ title: string; width?: string }>(), { width: "520px" });
const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="wbd-modal" @click.self="emit('close')">
    <div class="wbd-modal__panel" :style="{ width }">
      <header class="wbd-modal__head">
        <span class="wbd-modal__title">{{ title }}</span>
        <button type="button" class="wbd-modal__close" title="关闭" @click="emit('close')">×</button>
      </header>
      <div class="wbd-modal__body wb-scroll">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="wbd-modal__foot">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.wbd-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(24, 28, 38, 0.42);
}
.wbd-modal__panel {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 18px 48px rgba(24, 28, 38, 0.22);
  overflow: hidden;
}
.wbd-modal__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--wb-line-soft);
  flex: 0 0 auto;
}
.wbd-modal__title {
  flex: 1;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wb-ink);
}
.wbd-modal__close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.wbd-modal__close:hover {
  background: var(--wb-bg);
  color: var(--wb-ink);
}
.wbd-modal__body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px;
}
.wbd-modal__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--wb-line-soft);
  background: #fbfcfe;
  flex: 0 0 auto;
}
</style>
