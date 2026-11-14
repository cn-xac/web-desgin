<script setup lang="ts">
/**
 * 设计器自带的说明提示（问号图标 + 悬浮说明）。
 *
 * 为什么不用原生 title：出现延迟高、样式不可控，在弹窗里几乎看不清。
 * 为什么不用 CSS ::after 绝对定位：弹窗外壳是 `overflow: hidden` + 滚动容器
 * （ModalShell 的 panel/body），提示会被裁掉 —— 这里 Teleport 到 body
 * 并用 fixed 定位，彻底避开裁剪。
 *
 * 设计器不绑定任何 UI 库（换 Element Plus / antd 都不该改引擎），
 * 所以这是引擎自带的实现；适配包若要换成自家观感，可覆盖同名组件。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{ text: string; placement?: "top" | "bottom" }>(), {
  placement: "bottom",
});

const triggerRef = ref<HTMLElement | null>(null);
const visible = ref(false);
/** 弹层位置：top 与 bottom 二选一，靠近视口底部时自动翻到上方 */
const pos = ref<{ top: number | null; bottom: number | null; left: number }>({
  top: 0,
  bottom: null,
  left: 0,
});

const POP_WIDTH = 264;
/** 预估弹层高度：用于判断下方是否放得下，放不下就翻到上方 */
const ESTIMATED_HEIGHT = 140;

function place(): void {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const gap = 8;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - POP_WIDTH - 8));
  const below = rect.bottom + gap;
  const fitsBelow = below + ESTIMATED_HEIGHT <= window.innerHeight;

  if (props.placement === "top" || !fitsBelow) {
    pos.value = { top: null, bottom: Math.max(8, window.innerHeight - rect.top + gap), left };
  } else {
    pos.value = { top: below, bottom: null, left };
  }
}

function show(): void {
  place();
  visible.value = true;
}

function hide(): void {
  visible.value = false;
}

/** 弹窗内容滚动 / 窗口缩放时重新定位，避免提示与触发点错位 */
function reposition(): void {
  if (visible.value) place();
}

onMounted(() => {
  // capture 阶段才能收到内部滚动容器的 scroll 事件
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", reposition, true);
  window.removeEventListener("resize", reposition);
  visible.value = false;
});

const popStyle = computed(() => ({
  top: pos.value.top === null ? "auto" : `${pos.value.top}px`,
  bottom: pos.value.bottom === null ? "auto" : `${pos.value.bottom}px`,
  left: `${pos.value.left}px`,
}));
</script>

<template>
  <span class="wb-tip">
    <button
      ref="triggerRef"
      type="button"
      class="wb-tip__trigger"
      :aria-label="text"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      @click.stop
    >
      ?
    </button>
    <Teleport to="body">
      <div v-if="visible" class="wb-tip__pop" :style="popStyle">{{ text }}</div>
    </Teleport>
  </span>
</template>

<style scoped>
.wb-tip {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.wb-tip__trigger {
  width: 15px;
  height: 15px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--wb-line);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  cursor: help;
}
.wb-tip__trigger:hover {
  background: var(--wb-primary);
}
/* Teleport 到 body：固定定位，不受弹窗 overflow 裁剪 */
.wb-tip__pop {
  position: fixed;
  z-index: 3000;
  width: 264px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #2b3242;
  color: #fff;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.75;
  white-space: pre-line;
  text-align: left;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(20, 26, 40, 0.24);
}
</style>
