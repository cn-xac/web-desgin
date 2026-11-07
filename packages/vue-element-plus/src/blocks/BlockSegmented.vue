<script setup lang="ts">
/**
 * 分段控制器。选项用逗号分隔；选中项是展示态，不参与表单数据，
 * 需要收集值请用单选框（radio）。
 */
import { computed, ref } from "vue";
import { parseLabels } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    options?: string;
    value?: string;
    size?: "large" | "default" | "small";
    block?: boolean;
    disabled?: boolean;
  }>(),
  { options: "日,周,月", value: "", size: "default", block: false, disabled: false },
);

const items = computed(() =>
  parseLabels(props.options).map((label, index) => ({ label, value: String(index) })),
);

const current = ref("0");
const active = computed(() => {
  const at = items.value.findIndex((item) => item.label === props.value);
  return at >= 0 ? String(at) : props.value || current.value;
});
</script>

<template>
  <el-segmented
    :model-value="active"
    :options="items"
    :size="size"
    :block="block"
    :disabled="disabled"
    @update:model-value="(next: unknown) => (current = String(next))"
  />
</template>
