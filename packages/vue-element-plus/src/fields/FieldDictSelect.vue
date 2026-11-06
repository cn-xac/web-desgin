<script setup lang="ts">
/**
 * 业务组件示例：字典下拉。
 * 选项按字典编码从字典表取，Schema 里只存编码，换字典不用改页面。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    dict?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { dict: "priority", placeholder: "请选择", disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const DICTS: Record<string, Array<{ label: string; value: string }>> = {
  priority: [
    { label: "P0 紧急", value: "P0" },
    { label: "P1 高", value: "P1" },
    { label: "P2 中", value: "P2" },
    { label: "P3 低", value: "P3" },
  ],
  status: [
    { label: "待处理", value: "pending" },
    { label: "处理中", value: "processing" },
    { label: "已完成", value: "done" },
  ],
  channel: [
    { label: "官网", value: "web" },
    { label: "小程序", value: "miniapp" },
    { label: "线下", value: "offline" },
  ],
};

const items = computed(() => DICTS[props.dict] ?? DICTS.priority);
</script>

<template>
  <el-select
    :model-value="modelValue as never"
    :placeholder="placeholder"
    :disabled="disabled"
    clearable
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  >
    <el-option v-for="item in items" :key="item.value" :label="item.label" :value="item.value" />
  </el-select>
</template>
