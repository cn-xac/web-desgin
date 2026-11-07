<script setup lang="ts">
/**
 * 文字提示。包在子节点外面，鼠标移入显示 `content`。
 * 子节点为空时给一个占位触发区，否则 ElTooltip 找不到 reference 会渲染不出来。
 */
withDefaults(
  defineProps<{
    content?: string;
    placement?:
      | "top"
      | "top-start"
      | "top-end"
      | "bottom"
      | "bottom-start"
      | "bottom-end"
      | "left"
      | "left-start"
      | "left-end"
      | "right"
      | "right-start"
      | "right-end";
    effect?: "dark" | "light";
    trigger?: "hover" | "click" | "focus" | "contextmenu";
    disabled?: boolean;
    offset?: number;
    showAfter?: number;
  }>(),
  { content: "提示文字", placement: "top", effect: "dark", trigger: "hover", disabled: false, offset: 12, showAfter: 0 },
);
</script>

<template>
  <el-tooltip
    :content="content"
    :placement="placement"
    :effect="effect"
    :trigger="trigger"
    :disabled="disabled"
    :offset="Number(offset) || 12"
    :show-after="Number(showAfter) || 0"
  >
    <span class="wb-tooltip__trigger">
      <slot><span class="wb-tooltip__fallback">悬停查看提示</span></slot>
    </span>
  </el-tooltip>
</template>

<style scoped>
.wb-tooltip__trigger {
  display: inline-block;
}
.wb-tooltip__fallback {
  display: inline-block;
  padding: 4px 10px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
