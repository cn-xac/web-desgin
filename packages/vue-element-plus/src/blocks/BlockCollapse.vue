<script setup lang="ts">
/**
 * 折叠面板。内容用「标题:内容」成对配置，一行一项。
 *
 * 不用 acceptsChildren 的原因：折叠面板的内容区是多个并列的槽，
 * 引擎只能往一个默认槽里塞子节点，拖进来也分不清属于哪个面板。
 */
import { computed, ref, watch } from "vue";
import { parseLabels, parsePairs } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    items?: string;
    /** 默认展开项：写标题，或写序号（从 0 开始） */
    active?: string;
    accordion?: boolean;
  }>(),
  { items: "", active: "", accordion: false },
);

const list = computed(() => parsePairs(props.items));

/** 把「标题」换成 ElCollapse 需要的 name（这里统一用序号，标题可以重复） */
const names = computed<string[]>(() => {
  const raw = props.active.trim();
  if (!raw) return list.value.length ? ["0"] : [];
  return parseLabels(raw).map((entry) => {
    const at = list.value.findIndex((item) => item.label === entry);
    return at >= 0 ? String(at) : entry;
  });
});

// 设计态要能点开预览，所以自己持有展开状态；Schema 变了再同步回来
const open = ref<string[]>(names.value);
watch(names, (next) => (open.value = next));
</script>

<template>
  <el-collapse
    :model-value="open"
    :accordion="accordion"
    @update:model-value="(value: unknown) => (open = (Array.isArray(value) ? value : [value]) as string[])"
  >
    <el-collapse-item v-for="(item, index) in list" :key="index" :title="item.label" :name="String(index)">
      <div class="wb-collapse__body">{{ item.value }}</div>
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped>
.wb-collapse__body {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
}
</style>
