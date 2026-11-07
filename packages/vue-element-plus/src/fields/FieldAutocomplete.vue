<script setup lang="ts">
/**
 * 自动补全。建议列表来自 `options`（逗号分隔），按输入内容做前缀过滤。
 *
 * 真实项目里建议通常来自接口，但 Schema 存不了函数；
 * 需要远程搜索时用「下拉选择 + 开启 filterable」或者自定义物料。
 */
import { computed } from "vue";
import { parseLabels } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: string;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    debounce?: number;
    placement?: "top" | "bottom" | "top-start" | "bottom-start";
    valueKey?: string;
  }>(),
  {
    options: "北京,上海,广州,深圳",
    placeholder: "请输入",
    clearable: true,
    disabled: false,
    debounce: 300,
    placement: "bottom-start",
    valueKey: "value",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const suggestions = computed(() => parseLabels(props.options));

/** cb 拿到的是对象数组，展示字段固定为 value（EP 的约定） */
function fetchSuggestions(query: string, callback: (items: Array<Record<string, unknown>>) => void): void {
  const keyword = query.trim();
  const matched = keyword
    ? suggestions.value.filter((item) => item.includes(keyword))
    : suggestions.value;
  callback(matched.map((item) => ({ value: item })));
}

function onInput(value: unknown): void {
  emit("update:modelValue", value);
}
</script>

<template>
  <el-autocomplete
    :model-value="String(modelValue ?? '')"
    :fetch-suggestions="fetchSuggestions"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :debounce="Number(debounce) || 300"
    :placement="placement"
    :value-key="valueKey"
    @update:model-value="onInput"
    @select="(item: Record<string, unknown>) => emit('change', item[valueKey])"
  />
</template>
