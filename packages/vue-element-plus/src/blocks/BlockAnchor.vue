<script setup lang="ts">
/**
 * 锚点。每项写成「文案:锚点 ID」，渲染成指向 #id 的锚点链接。
 * 容器模式下需要被链接的节点带 id，低代码里一般配合「容器」物料的节点 ID 使用。
 */
import { computed } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    direction?: "vertical" | "horizontal";
    type?: "default" | "underline";
    offset?: number;
    affix?: boolean;
    bounds?: number;
  }>(),
  { items: "基本信息:basic,详细配置:detail,权限设置:permission", direction: "vertical", type: "underline", offset: 0, affix: true, bounds: 5 },
);

const list = computed(() => parsePairs(props.items));
</script>

<template>
  <el-anchor :direction="direction" :type="type" :offset="Number(offset) || 0" :affix="affix" :bounds="Number(bounds) || 5">
    <el-anchor-link
      v-for="(item, index) in list"
      :key="index"
      :href="item.value ? `#${item.value}` : undefined"
      :title="item.label"
    />
  </el-anchor>
</template>
