<script setup lang="ts">
/**
 * 走马灯。每项是一个图片地址（换行或逗号分隔）。
 * 没有图片时给一块占位，避免空转。
 */
import { computed } from "vue";
import { parseLabels } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    height?: string;
    trigger?: "hover" | "click";
    autoplay?: boolean;
    interval?: number;
    type?: "" | "card";
    indicatorPosition?: "" | "outside" | "none";
    arrow?: "always" | "hover" | "never";
    initialIndex?: number;
  }>(),
  {
    items: "",
    height: "200px",
    trigger: "hover",
    autoplay: true,
    interval: 3000,
    type: "",
    indicatorPosition: "",
    arrow: "hover",
    initialIndex: 0,
  },
);

const list = computed(() => parseLabels(props.items));
</script>

<template>
  <el-carousel
    :height="height || '200px'"
    :trigger="trigger"
    :autoplay="autoplay"
    :interval="Number(interval) || 3000"
    :type="type || undefined"
    :indicator-position="indicatorPosition || undefined"
    :arrow="arrow"
    :initial-index="Number(initialIndex) || 0"
  >
    <el-carousel-item v-for="(src, index) in list" :key="index">
      <img v-if="src" class="wb-carousel__img" :src="src" alt="" />
      <div v-else class="wb-carousel__placeholder">第 {{ index + 1 }} 屏</div>
    </el-carousel-item>
    <!-- 一条都没配时也要有一屏：ElCarousel 没有子项时高度塌成 0，画布上点不中 -->
    <el-carousel-item v-if="!list.length">
      <div class="wb-carousel__placeholder">在属性面板填写图片地址</div>
    </el-carousel-item>
  </el-carousel>
</template>

<style scoped>
.wb-carousel__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.wb-carousel__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
