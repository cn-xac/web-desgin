<script setup lang="ts">
/**
 * 下拉菜单。触发元素是一个按钮（文案由 `text` 决定），菜单项逗号分隔。
 * 纯展示组件：菜单点击的动作由 Schema 的 events 挂在根节点上，这里不拦事件。
 */
import { computed } from "vue";
import { parseLabels } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    text?: string;
    items?: string;
    type?: "primary" | "success" | "warning" | "danger" | "info" | "default";
    size?: "large" | "default" | "small";
    trigger?: "hover" | "click" | "contextmenu";
    placement?:
      | "top"
      | "top-start"
      | "top-end"
      | "bottom"
      | "bottom-start"
      | "bottom-end";
    splitButton?: boolean;
    hideOnClick?: boolean;
    disabled?: boolean;
  }>(),
  {
    text: "更多操作",
    items: "编辑,复制,删除",
    type: "default",
    size: "default",
    trigger: "hover",
    placement: "bottom-start",
    splitButton: false,
    hideOnClick: true,
    disabled: false,
  },
);

const list = computed(() => parseLabels(props.items));
</script>

<template>
  <el-dropdown :trigger="trigger" :placement="placement" :split-button="splitButton" :hide-on-click="hideOnClick" :disabled="disabled">
    <el-button :type="type" :size="size" :disabled="disabled">{{ text }}</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="(item, index) in list" :key="index">{{ item }}</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
