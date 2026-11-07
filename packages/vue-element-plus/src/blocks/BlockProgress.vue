<script setup lang="ts">
/**
 * 进度条。`percentage` 同时接受数字与绑定表达式（渲染器已求值）。
 * 类型为 dashboard 时 ElProgress 额外需要 width/height，没配就用默认。
 */
withDefaults(
  defineProps<{
    percentage?: number;
    type?: "line" | "circle" | "dashboard";
    strokeWidth?: number;
    textInside?: boolean;
    status?: "" | "success" | "exception" | "warning";
    color?: string;
    showText?: boolean;
    striped?: boolean;
    stripedFlow?: boolean;
    width?: number;
    height?: number;
    duration?: number;
  }>(),
  {
    percentage: 50,
    type: "line",
    strokeWidth: 6,
    textInside: false,
    status: "",
    color: "",
    showText: true,
    striped: false,
    stripedFlow: false,
    width: 126,
    height: 126,
    duration: 3,
  },
);

const clamp = (value: number | undefined): number => Math.min(100, Math.max(0, Number(value) || 0));
</script>

<template>
  <el-progress
    :percentage="clamp(percentage)"
    :type="type"
    :stroke-width="Number(strokeWidth) || 6"
    :text-inside="textInside"
    :status="status || undefined"
    :color="color || undefined"
    :show-text="showText"
    :striped="striped"
    :striped-flow="stripedFlow"
    :width="Number(width) || 126"
    :height="Number(height) || 126"
    :duration="Number(duration) || 3"
  />
</template>
