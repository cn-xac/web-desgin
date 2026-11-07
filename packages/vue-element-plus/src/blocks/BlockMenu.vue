<script setup lang="ts">
/**
 * 导航菜单。每行一个菜单项，用 `>` 表示层级：
 * ```
 * 首页
 * 订单管理>待办订单>超时订单
 * 系统设置
 * ```
 * 与级联选择共用同一套路径写法，学一次到处能用。
 */
import { computed } from "vue";
import { parsePaths } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    mode?: "horizontal" | "vertical";
    collapse?: boolean;
    backgroundColor?: string;
    textColor?: string;
    activeTextColor?: string;
    defaultActive?: string;
    ellipsis?: boolean;
    uniqueOpened?: boolean;
  }>(),
  {
    items: "工作台\n订单管理>待办订单>超时订单\n系统设置",
    mode: "horizontal",
    collapse: false,
    backgroundColor: "",
    textColor: "",
    activeTextColor: "",
    defaultActive: "",
    ellipsis: true,
    uniqueOpened: false,
  },
);

const tree = computed(() => parsePaths(props.items));

/** 默认高亮第一项，避免菜单一片灰看不出效果 */
const active = computed(() => props.defaultActive || tree.value[0]?.value || "");
</script>

<template>
  <el-menu
    :mode="mode"
    :collapse="collapse"
    :background-color="backgroundColor || undefined"
    :text-color="textColor || undefined"
    :active-text-color="activeTextColor || undefined"
    :default-active="active"
    :ellipsis="ellipsis"
    :unique-opened="uniqueOpened"
  >
    <template v-for="node in tree" :key="node.value">
      <el-sub-menu v-if="node.children?.length" :index="node.value">
        <template #title>{{ node.label }}</template>
        <el-menu-item v-for="child in node.children" :key="child.value" :index="child.value">
          {{ child.label }}
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else :index="node.value">{{ node.label }}</el-menu-item>
    </template>
  </el-menu>
</template>
