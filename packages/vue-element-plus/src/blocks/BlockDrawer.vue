<script setup lang="ts">
/**
 * 抽屉。与对话框同一个思路：`visible` 默认 true，设计态当右侧画布用。
 * `bodyClass` 之类的挂在 DOM 上的属性不暴露 —— 低代码里配置 class 没有入口可用。
 */
withDefaults(
  defineProps<{
    title?: string;
    visible?: boolean;
    size?: number | string;
    direction?: "rtl" | "ltr" | "ttb" | "btt";
    modal?: boolean;
    showClose?: boolean;
    withHeader?: boolean;
    closeOnClickModal?: boolean;
  }>(),
  {
    title: "抽屉",
    visible: true,
    size: "30%",
    direction: "rtl",
    modal: false,
    showClose: true,
    withHeader: true,
    closeOnClickModal: false,
  },
);
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="title"
    :size="size"
    :direction="direction"
    :modal="modal"
    :show-close="showClose"
    :with-header="withHeader"
    :close-on-click-modal="closeOnClickModal"
  >
    <slot />
  </el-drawer>
</template>
