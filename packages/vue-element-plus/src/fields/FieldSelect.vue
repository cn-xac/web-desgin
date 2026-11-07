<script setup lang="ts">
/**
 * 下拉选择。包一层的原因：ElSelect 的选项要写成 el-option 子节点，
 * 而 Schema 只有扁平 props —— 这里把「逗号分隔的选项」翻译成子节点。
 *
 * 除选项外的属性一律直通 ElSelect，不做二次解释：
 * 属性面板里能设的，就是 EP 真实支持的。
 */
import { computed } from "vue";
import { parseOptions } from "@x-ac/design-core";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    options?: unknown;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    filterable?: boolean;
    allowCreate?: boolean;
    multipleLimit?: number;
    collapseTags?: boolean;
    collapseTagsTooltip?: boolean;
    loading?: boolean;
    loadingText?: string;
    noDataText?: string;
    noMatchText?: string;
    size?: "large" | "default" | "small";
    effect?: "dark" | "light";
    tagType?: "primary" | "success" | "warning" | "danger" | "info";
    reserveKeyword?: boolean;
    fitInputWidth?: boolean;
    showArrow?: boolean;
    automaticDropdown?: boolean;
    placement?: "top" | "bottom" | "left" | "right" | "top-start" | "bottom-start" | "top-end" | "bottom-end";
  }>(),
  {
    placeholder: "请选择",
    clearable: true,
    disabled: false,
    multiple: false,
    filterable: false,
    allowCreate: false,
    multipleLimit: 0,
    collapseTags: false,
    collapseTagsTooltip: false,
    loading: false,
    loadingText: "",
    noDataText: "",
    noMatchText: "",
    size: "default",
    effect: "light",
    tagType: "info",
    reserveKeyword: true,
    fitInputWidth: true,
    showArrow: true,
    automaticDropdown: false,
    placement: "bottom-start",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const items = computed(() => parseOptions(props.options));

function onChange(value: unknown): void {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-select
    :model-value="modelValue as never"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :multiple="multiple"
    :filterable="filterable"
    :allow-create="allowCreate"
    :multiple-limit="Number(multipleLimit) || 0"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :loading="loading"
    :loading-text="loadingText || undefined"
    :no-data-text="noDataText || undefined"
    :no-match-text="noMatchText || undefined"
    :size="size"
    :effect="effect"
    :tag-type="tagType"
    :reserve-keyword="reserveKeyword"
    :fit-input-width="fitInputWidth"
    :show-arrow="showArrow"
    :automatic-dropdown="automaticDropdown"
    :placement="placement"
    @update:model-value="onChange"
  >
    <el-option v-for="item in items" :key="String(item.value)" :label="item.label" :value="item.value" />
  </el-select>
</template>
