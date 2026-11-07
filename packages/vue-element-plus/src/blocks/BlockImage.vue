<script setup lang="ts">
/**
 * 图片。
 *
 * 为什么包一层而不是直接映射 ElImage：EP 的「点击预览」靠 `preview-src-list`
 * （一个数组），而属性面板上用户想要的是一个「点击预览」开关。
 * 直接暴露 preview-src-list 会逼用户手写数组，所以这里把开关翻译成数组。
 *
 * `width` / `radius` 不在这里处理 —— core 的 propStyle 会把它们转成 style，
 * 走统一链路（导静态 HTML 时同样生效）。
 */
withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    fit?: "fill" | "contain" | "cover" | "none" | "scale-down";
    preview?: boolean;
    lazy?: boolean;
    hideOnClickModal?: boolean;
    infinite?: boolean;
    zoomRate?: number;
    showProgress?: boolean;
  }>(),
  {
    src: "",
    alt: "",
    fit: "cover",
    preview: false,
    lazy: false,
    hideOnClickModal: false,
    infinite: true,
    zoomRate: 1.2,
    showProgress: false,
  },
);
</script>

<template>
  <el-image
    class="wb-image"
    :src="src || undefined"
    :alt="alt || undefined"
    :fit="fit"
    :lazy="lazy"
    :preview-src-list="preview && src ? [src] : undefined"
    :hide-on-click-modal="hideOnClickModal"
    :infinite="infinite"
    :zoom-rate="Number(zoomRate) || 1.2"
    :show-progress="showProgress"
  >
    <template #error>
      <div class="wb-image__error">图片加载失败</div>
    </template>
    <template #placeholder>
      <div class="wb-image__placeholder">加载中</div>
    </template>
  </el-image>
</template>

<style scoped>
.wb-image {
  border-radius: inherit;
}
.wb-image__error,
.wb-image__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 80px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}
</style>
