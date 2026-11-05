<script setup lang="ts">
import { computed } from "vue";

export interface TableColumn {
  label: string;
  prop: string;
  width?: number | string;
}

const props = withDefaults(
  defineProps<{
    columns?: TableColumn[] | string;
    data?: unknown;
    border?: boolean;
    stripe?: boolean;
    emptyText?: string;
    rowKey?: string;
  }>(),
  { border: true, stripe: false, emptyText: "暂无数据" },
);

const emit = defineEmits<{ (e: "row-click", row: Record<string, unknown>, index: number): void }>();

/** 兼容两种写法：结构化数组 / "标签:字段,标签:字段" 字符串 */
const normalizedColumns = computed<TableColumn[]>(() => {
  const raw = props.columns;
  if (Array.isArray(raw)) {
    return raw
      .map((c) => ({ label: String(c?.label ?? c?.prop ?? ""), prop: String(c?.prop ?? ""), width: c?.width }))
      .filter((c) => c.prop);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [label, prop] = pair.split(":").map((s) => s.trim());
        return { label: label || prop, prop: prop || label };
      })
      .filter((c) => c.prop);
  }
  return [];
});

const rows = computed<Record<string, unknown>[]>(() => {
  const raw = props.data;
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") return [raw as Record<string, unknown>];
  return [];
});

function display(row: Record<string, unknown>, prop: string): string {
  const value = prop.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, row);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
</script>

<template>
  <el-table
    class="wb-table"
    :data="rows"
    :border="border"
    :stripe="stripe"
    :row-key="rowKey || undefined"
    :empty-text="emptyText"
    size="default"
    @row-click="(row: Record<string, unknown>, index: number) => emit('row-click', row, index)"
  >
    <el-table-column
      v-for="col in normalizedColumns"
      :key="col.prop"
      :label="col.label"
      :prop="col.prop"
      :width="col.width"
      show-overflow-tooltip
    >
      <template #default="{ row }">{{ display(row, col.prop) }}</template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.wb-table {
  width: 100%;
}
.wb-table :deep(th.el-table__cell) {
  background: #fafbfd;
  color: var(--wb-ink2);
  font-weight: 600;
  font-size: 13px;
}
.wb-table :deep(.el-table__cell) {
  font-size: 13px;
  color: var(--wb-ink2);
}
</style>
