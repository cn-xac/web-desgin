<script setup lang="ts">
/**
 * 级联选择。选项用「路径」写法，每行一条：
 * ```
 * 华东/上海/浦东
 * 华东/上海/徐汇
 * ```
 * 中间层自动合并，重复的祖先只写一次也认。
 */
import { computed } from "vue";
import { parsePaths } from "../utils/parse";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: string;
    placeholder?: string;
    separator?: string;
    clearable?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    checkStrictly?: boolean;
    emitPath?: boolean;
    filterable?: boolean;
    showAllLevels?: boolean;
  }>(),
  {
    placeholder: "请选择",
    options: "",
    separator: "/",
    clearable: true,
    disabled: false,
    multiple: false,
    checkStrictly: false,
    emitPath: true,
    filterable: false,
    showAllLevels: true,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const tree = computed(() => parsePaths(props.options));

const cascaderProps = computed(() => ({
  multiple: props.multiple,
  checkStrictly: props.checkStrictly,
  emitPath: props.emitPath,
  expandTrigger: "hover" as const,
}));
</script>

<template>
  <el-cascader
    :model-value="modelValue as never"
    :options="tree"
    :props="cascaderProps"
    :placeholder="placeholder"
    :separator="separator"
    :clearable="clearable"
    :disabled="disabled"
    :filterable="filterable"
    :show-all-levels="showAllLevels"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  />
</template>
