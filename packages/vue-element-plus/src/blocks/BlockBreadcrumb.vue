<script setup lang="ts">
/**
 * 面包屑。每项写成「文案:链接」，链接留空则只显示文字。
 */
import { computed } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    separator?: string;
    separatorIcon?: string;
  }>(),
  { items: "首页:/,订单管理:/orders,订单详情", separator: "/", separatorIcon: "" },
);

const list = computed(() => parsePairs(props.items));
</script>

<template>
  <el-breadcrumb :separator="separatorIcon ? ' ' : separator">
    <el-breadcrumb-item v-for="(item, index) in list" :key="index" :to="item.value || undefined">
      {{ item.label }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
