<script setup lang="ts">
/**
 * 水印。包在子节点外面，子节点为空时给一块占位区域。
 */
withDefaults(
  defineProps<{
    content?: string;
    fontSize?: number;
    fontColor?: string;
    rotate?: number;
    gapX?: number;
    gapY?: number;
    zIndex?: number;
  }>(),
  { content: "内部资料", fontSize: 16, fontColor: "rgba(0, 0, 0, 0.15)", rotate: -22, gapX: 100, gapY: 100, zIndex: 9 },
);

const gap = (x: number, y: number): [number, number] => [Number(x) || 100, Number(y) || 100];
</script>

<template>
  <el-watermark
    :content="content"
    :font="{ fontSize: Number(fontSize) || 16, color: fontColor }"
    :rotate="Number(rotate) || -22"
    :gap="gap(gapX, gapY)"
    :z-index="Number(zIndex) || 9"
  >
    <div class="wb-watermark__inner">
      <slot><div class="wb-watermark__placeholder">水印区域</div></slot>
    </div>
  </el-watermark>
</template>

<style scoped>
.wb-watermark__inner {
  min-height: 80px;
}
.wb-watermark__placeholder {
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
