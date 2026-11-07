<script setup lang="ts">
/**
 * 头像。有 `src` 显示图片，否则显示 `text`（文字头像），
 * 两者都空时显示默认占位图标。
 */
withDefaults(
  defineProps<{
    text?: string;
    src?: string;
    alt?: string;
    shape?: "circle" | "square";
    size?: number | "large" | "default" | "small";
    fit?: "fill" | "contain" | "cover" | "none" | "scale-down";
  }>(),
  { text: "", src: "", alt: "", shape: "circle", size: "default", fit: "cover" },
);

/** 数字大小按 px，字符串（large/default/small）原样交给 ElAvatar */
function sizeOf(value: number | string): number | "large" | "default" | "small" {
  if (typeof value === "number") return value;
  if (value === "large" || value === "default" || value === "small") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "default";
}
</script>

<template>
  <el-avatar :src="src || undefined" :alt="alt || undefined" :shape="shape" :size="sizeOf(size)" :fit="fit">
    <slot />
  </el-avatar>
</template>
