<script setup lang="ts">
/**
 * 步骤条。每项写成「标题:描述」，描述可省略。
 */
import { computed } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    active?: number;
    processStatus?: "wait" | "process" | "finish" | "error" | "success";
    finishStatus?: "wait" | "process" | "finish" | "error" | "success";
    direction?: "horizontal" | "vertical";
    simple?: boolean;
    space?: number | string;
    alignCenter?: boolean;
  }>(),
  {
    items: "填写信息:基础资料,上传材料:证明材料,提交审核,完成",
    active: 1,
    processStatus: "process",
    finishStatus: "finish",
    direction: "horizontal",
    simple: false,
    space: "",
    alignCenter: false,
  },
);

const list = computed(() => parsePairs(props.items));
</script>

<template>
  <el-steps
    :active="Number(active) || 0"
    :process-status="processStatus"
    :finish-status="finishStatus"
    :direction="direction"
    :simple="simple"
    :space="space === '' ? undefined : space"
    :align-center="alignCenter"
  >
    <el-step v-for="(item, index) in list" :key="index" :title="item.label" :description="item.value || undefined" />
  </el-steps>
</template>
