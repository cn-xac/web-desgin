<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    text?: string;
    level?: number;
    align?: "left" | "center" | "right";
  }>(),
  { text: "区域标题", level: 3, align: "left" },
);

const tag = computed(() => `h${Math.min(6, Math.max(1, Number(props.level) || 3))}`);
</script>

<template>
  <!-- 正文由渲染器通过 slot 传入（textProp），无 slot 时回落到 text 属性 -->
  <component :is="tag" class="wb-title" :style="{ textAlign: align }">
    <slot>{{ text }}</slot>
  </component>
</template>

<style scoped>
.wb-title {
  margin: 0 0 12px;
  font-weight: 600;
  color: var(--wb-ink);
  line-height: 1.4;
}
h2.wb-title {
  font-size: 22px;
}
h3.wb-title {
  font-size: 17px;
}
h4.wb-title {
  font-size: 15px;
}
h5.wb-title {
  font-size: 14px;
}
</style>
