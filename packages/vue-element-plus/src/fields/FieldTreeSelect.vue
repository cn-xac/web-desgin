<script setup lang="ts">
/**
 * 树选择。选项写法与级联选择一致（`父/子/孙`，一行一条路径），
 * 区别只在于下拉里是可展开的树而不是级联列。
 */
import { computed } from "vue";
import { parsePaths } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: string;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    checkStrictly?: boolean;
    filterable?: boolean;
    showCheckbox?: boolean;
  }>(),
  {
    options: "",
    placeholder: "请选择",
    clearable: true,
    disabled: false,
    multiple: false,
    checkStrictly: true,
    filterable: true,
    showCheckbox: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const tree = computed(() => parsePaths(props.options));
</script>

<template>
  <el-tree-select
    :model-value="modelValue as never"
    :data="tree"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :multiple="multiple"
    :check-strictly="checkStrictly"
    :filterable="filterable"
    :show-checkbox="showCheckbox"
    :render-after-expand="false"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  />
</template>
