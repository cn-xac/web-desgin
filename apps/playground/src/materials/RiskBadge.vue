<script setup lang="ts">
/**
 * 业务自定义物料示例（T-032）：风险等级徽章。
 *
 * 刻意不依赖 Element Plus —— 用来证明「业务组件可以完全自研，
 * 只靠 registerMaterials 一份声明就进设计器物面板、属性面板和渲染器」。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    text?: string;
    /** 等级：决定默认配色，显式 color 优先 */
    level?: string;
    /** 自定义颜色，留空按等级取色 */
    color?: string;
    round?: boolean;
  }>(),
  { text: "风险待评估", level: "中", color: "", round: true },
);

const LEVEL_TONE: Record<string, string> = { 高: "#f56c6c", 中: "#e6a23c", 低: "#67c23a" };

const tone = computed(() => props.color || LEVEL_TONE[props.level] || "#909399");
</script>

<template>
  <span class="risk" :class="{ 'risk--round': round }" :style="{ '--risk-tone': tone }">
    <i class="risk__dot" />
    <span class="risk__text">{{ text }}</span>
    <em class="risk__level">{{ level }}</em>
  </span>
</template>

<style scoped>
.risk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--risk-tone) 38%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--risk-tone) 10%, #fff);
  font-size: 12px;
  line-height: 20px;
  color: var(--risk-tone);
}
.risk--round {
  border-radius: 999px;
}
.risk__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--risk-tone);
}
.risk__level {
  font-style: normal;
  font-weight: 600;
}
</style>
