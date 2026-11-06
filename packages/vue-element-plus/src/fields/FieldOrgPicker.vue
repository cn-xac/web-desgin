<script setup lang="ts">
/**
 * 业务组件示例：组织选择。
 * 真实项目替换为接口取数，这里内置一棵静态组织树，验证「业务组件走物料协议接入」的路径。
 */
withDefaults(
  defineProps<{
    modelValue?: unknown;
    placeholder?: string;
    checkStrictly?: boolean;
    disabled?: boolean;
  }>(),
  { placeholder: "请选择组织", checkStrictly: true, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void;
  (e: "change", value: unknown): void;
}>();

const ORG_TREE = [
  {
    value: "hq",
    label: "集团总部",
    children: [
      { value: "hq-tech", label: "技术中心", children: [{ value: "hq-tech-fe", label: "前端组" }, { value: "hq-tech-be", label: "后端组" }] },
      { value: "hq-product", label: "产品中心", children: [{ value: "hq-product-pm", label: "产品组" }] },
      { value: "hq-design", label: "设计中心" },
    ],
  },
  {
    value: "sh",
    label: "上海分公司",
    children: [
      { value: "sh-sales", label: "销售部" },
      { value: "sh-ops", label: "运营部" },
    ],
  },
];
</script>

<template>
  <el-tree-select
    :model-value="modelValue as never"
    :data="ORG_TREE"
    :placeholder="placeholder"
    :check-strictly="checkStrictly"
    :disabled="disabled"
    node-key="value"
    check-on-click-node
    clearable
    filterable
    style="width: 100%"
    @update:model-value="
      (v: unknown) => {
        emit('update:modelValue', v);
        emit('change', v);
      }
    "
  />
</template>
