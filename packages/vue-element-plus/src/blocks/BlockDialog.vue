<script setup lang="ts">
/**
 * 对话框。
 *
 * 设计器里的定位是「弹层内容的画布」：`visible` 默认 true，这样拖进来的内容
 * 在设计态和预览态都能看到。运行时要按条件弹出，就在页面状态里放一个布尔值，
 * 把 `visible` 写成 {{dialogOpen}} 表达式 —— 渲染器会求值。
 */
withDefaults(
  defineProps<{
    title?: string;
    visible?: boolean;
    width?: number | string;
    fullscreen?: boolean;
    top?: string;
    modal?: boolean;
    showClose?: boolean;
    closeOnClickModal?: boolean;
    draggable?: boolean;
    alignCenter?: boolean;
  }>(),
  {
    title: "对话框",
    visible: true,
    width: 520,
    fullscreen: false,
    top: "15vh",
    // 设计态默认不要遮罩：遮罩会盖住整个画布，其它节点点不到
    modal: false,
    showClose: true,
    closeOnClickModal: false,
    draggable: true,
    alignCenter: false,
  },
);
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    :width="width"
    :fullscreen="fullscreen"
    :top="top"
    :modal="modal"
    :show-close="showClose"
    :close-on-click-modal="closeOnClickModal"
    :draggable="draggable"
    :align-center="alignCenter"
  >
    <slot />
  </el-dialog>
</template>
