<script setup lang="ts">
/**
 * 徽标。`text` 是挂角标的主体内容，`value` 是角标数字。
 * ElBadge 默认按内容宽度撑开，空内容会塌成 0 宽 —— 给个 fallback 文字。
 */
withDefaults(
  defineProps<{
    text?: string;
    value?: number | string;
    max?: number;
    isDot?: boolean;
    hidden?: boolean;
    showZero?: boolean;
    type?: "primary" | "success" | "warning" | "danger" | "info";
    color?: string;
  }>(),
  { text: "消息", value: 0, max: 99, isDot: false, hidden: false, showZero: false, type: "danger", color: "" },
);

function numberOr(value: number | string | undefined): number | string | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : String(value);
}
</script>

<template>
  <el-badge
    :value="numberOr(value)"
    :max="Number(max) || 99"
    :is-dot="isDot"
    :hidden="hidden"
    :show-zero="showZero"
    :type="type"
    :color="color || undefined"
  >
    <span class="wb-badge__content"><slot /></span>
  </el-badge>
</template>

<style scoped>
.wb-badge__content {
  display: inline-block;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
