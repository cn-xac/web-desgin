<script setup lang="ts">
/**
 * 气泡确认。触发元素是按钮（文案 `text`），确认动作请在节点的 click 事件里配。
 */
withDefaults(
  defineProps<{
    text?: string;
    title?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    type?: "primary" | "success" | "warning" | "danger" | "info" | "default";
    size?: "large" | "default" | "small";
    placement?: "top" | "bottom" | "left" | "right" | "top-start" | "bottom-start";
    width?: number;
    hideIcon?: boolean;
    disabled?: boolean;
  }>(),
  {
    text: "删除",
    title: "确定删除吗？",
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "danger",
    size: "default",
    placement: "top",
    width: 150,
    hideIcon: false,
    disabled: false,
  },
);
</script>

<template>
  <el-popconfirm
    :title="title"
    :confirm-button-text="confirmButtonText"
    :cancel-button-text="cancelButtonText"
    :placement="placement"
    :width="Number(width) || 150"
    :hide-icon="hideIcon"
  >
    <template #reference>
      <el-button :type="type" :size="size" :disabled="disabled">{{ text }}</el-button>
    </template>
  </el-popconfirm>
</template>
