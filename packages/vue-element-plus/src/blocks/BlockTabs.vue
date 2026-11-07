<script setup lang="ts">
/**
 * 标签页。同样用「标签:内容」成对配置。
 * 内容区支持 {{}} 表达式 —— 文本走插值，渲染器在 props 层已经求值。
 */
import { computed, ref, watch } from "vue";
import { parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    active?: string;
    type?: "" | "card" | "border-card";
    tabPosition?: "top" | "right" | "bottom" | "left";
    stretch?: boolean;
    closable?: boolean;
  }>(),
  { items: "", active: "", type: "", tabPosition: "top", stretch: false, closable: false },
);

const list = computed(() => parsePairs(props.items));

const current = ref("");
watch(
  () => [props.items, props.active] as const,
  () => {
    const raw = props.active.trim();
    const at = list.value.findIndex((item) => item.label === raw);
    current.value = raw ? (at >= 0 ? String(at) : raw) : list.value.length ? "0" : "";
  },
  { immediate: true },
);
</script>

<template>
  <el-tabs
    v-model="current"
    :type="type || undefined"
    :tab-position="tabPosition"
    :stretch="stretch"
    :closable="closable"
  >
    <el-tab-pane v-for="(item, index) in list" :key="index" :label="item.label" :name="String(index)">
      <div class="wb-tabs__body">{{ item.value }}</div>
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.wb-tabs__body {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  padding: 4px 0;
}
</style>
