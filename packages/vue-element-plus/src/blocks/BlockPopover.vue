<script setup lang="ts">
/**
 * 弹出框。`content` 是弹层正文，子节点是触发区。
 * 正文刻意不给插槽：低代码里往弹层拖节点要处理定位与层级，
 * 真需要复杂弹层请用抽屉 / 对话框物料。
 */
withDefaults(
  defineProps<{
    title?: string;
    content?: string;
    placement?: "top" | "bottom" | "left" | "right" | "top-start" | "bottom-start" | "top-end" | "bottom-end";
    trigger?: "hover" | "click" | "focus" | "contextmenu";
    effect?: "dark" | "light";
    width?: number | string;
    disabled?: boolean;
    showAfter?: number;
  }>(),
  {
    title: "",
    content: "在这里放一段说明",
    placement: "bottom",
    trigger: "click",
    effect: "light",
    width: 200,
    disabled: false,
    showAfter: 0,
  },
);
</script>

<template>
  <el-popover
    :title="title || undefined"
    :content="content"
    :placement="placement"
    :trigger="trigger"
    :effect="effect"
    :width="width"
    :disabled="disabled"
    :show-after="Number(showAfter) || 0"
    popper-class="wb-popover"
  >
    <template #reference>
      <span class="wb-popover__trigger">
        <slot><span class="wb-popover__fallback">点击查看</span></slot>
      </span>
    </template>
  </el-popover>
</template>

<style scoped>
.wb-popover__trigger {
  display: inline-block;
}
.wb-popover__fallback {
  display: inline-block;
  padding: 4px 10px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
