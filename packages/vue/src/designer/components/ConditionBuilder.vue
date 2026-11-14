<script setup lang="ts">
/**
 * 通用多条件构造器弹窗（rfD7Jv），供「元素的显示和隐藏逻辑优化」(r5u4Ul) 调用。
 *
 * 数据模型与求值全部在 core，本组件只负责编辑 UI：
 * - 每行一个条件：序号 + 左元素 + 关系 + 右值；特殊场景可勾选「仅值」；
 * - 条件间：并且 / 或者 / 高级（按序号组合，如 1 and (2 or 3)）；
 * - 子表单内元素只能选同一子表单内的字段（core 的清单已裁剪）；
 * - 子表单外引用明细字段时显示聚合口径，缺省求和。
 *
 * 与适配包解耦：控件用原生 select / input，CI stub 环境也能真实点击测试。
 */
import { computed, ref, watch } from "vue";
import {
  CONDITION_AGGREGATES,
  CONDITION_MODE_OPTIONS,
  CONDITION_OPERATOR_OPTIONS,
  collectConditionElements,
  findLocation,
  validateAdvancedExpression,
  type ConditionGroup,
  type ConditionMode,
  type ConditionRow,
  type VisibilityConfig,
} from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useConditionDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";

interface DraftRow extends ConditionRow {
  /** 仅 UI 状态：勾选后该行只有 value，不落库 */
  valueOnly?: boolean;
}

interface Draft extends Omit<ConditionGroup, "rows"> {
  rows: DraftRow[];
}

const store = useDesignerStore();
const dialog = useConditionDialog();
const notify = useNotify();

function blankRow(): DraftRow {
  return { left: "", operator: "eq", value: "", aggregate: "sum" };
}

const draft = ref<Draft>({ mode: "and", rows: [blankRow()], expression: "" });

const elements = computed(() =>
  collectConditionElements(store.page, { nodeId: dialog.target.value?.nodeId }),
);

const title = computed(() =>
  dialog.target.value?.kind === "hide" ? "配置隐藏条件" : "配置显示条件",
);

const expressionError = computed(() => {
  if (draft.value.mode !== "advanced") return "";
  return validateAdvancedExpression(draft.value.expression ?? "", draft.value.rows.length) ?? "";
});

const scopeTip = computed(() => {
  const target = dialog.target.value;
  if (!target) return "";
  return elements.value.some((element) => element.inSubform)
    ? "可选元素已按所在子表单裁剪；引用明细字段时需指定聚合口径。"
    : "可选元素来自当前页面；引用子表单明细字段时需指定聚合口径。";
});

watch(
  () => [dialog.visible.value, dialog.target.value?.nodeId, dialog.target.value?.kind] as const,
  ([visible]) => {
    if (visible) load();
  },
  { immediate: true },
);

function load(): void {
  const target = dialog.target.value;
  const group = target
    ? findLocation(store.page.children, target.nodeId)?.node?.visibility?.[target.kind]
    : undefined;
  if (group) {
    draft.value = {
      mode: group.mode,
      expression: group.expression ?? "",
      rows: group.rows.map((row) => ({
        ...JSON.parse(JSON.stringify(row)),
        aggregate: row.aggregate ?? "sum",
        valueOnly: !row.left && !row.operator,
      })),
    };
  } else {
    draft.value = { mode: "and", rows: [blankRow()], expression: "" };
  }
}

function requiresAggregate(left: string | undefined): boolean {
  return elements.value.find((element) => element.path === left)?.requiresAggregate ?? false;
}

function isUnary(operator: ConditionRow["operator"]): boolean {
  return CONDITION_OPERATOR_OPTIONS.find((option) => option.value === operator)?.unary ?? false;
}

function addRow(): void {
  draft.value.rows.push(blankRow());
}

function removeRow(index: number): void {
  draft.value.rows.splice(index, 1);
}

function toggleValueOnly(row: DraftRow): void {
  row.valueOnly = !row.valueOnly;
  if (row.valueOnly) {
    row.left = undefined;
    row.operator = undefined;
    row.aggregate = undefined;
  } else {
    row.left = "";
    row.operator = "eq";
  }
}

function cleanRows(rows: DraftRow[]): ConditionRow[] {
  return rows
    .filter((row) =>
      row.valueOnly ? String(row.value ?? "").trim() !== "" : Boolean(row.left && row.operator),
    )
    .map((row) => {
      if (row.valueOnly) return { value: row.value };
      const out: ConditionRow = { left: row.left, operator: row.operator };
      if (row.aggregate && requiresAggregate(row.left)) out.aggregate = row.aggregate;
      if (!isUnary(row.operator)) out.value = row.value;
      return out;
    });
}

function save(): void {
  const target = dialog.target.value;
  if (!target) return;
  if (expressionError.value) {
    notify(expressionError.value, "error");
    return;
  }

  const node = findLocation(store.page.children, target.nodeId)?.node;
  const next: VisibilityConfig = { ...(node?.visibility ?? {}) };
  const rows = cleanRows(draft.value.rows);
  if (!rows.length) {
    delete next[target.kind];
  } else {
    next[target.kind] = {
      mode: draft.value.mode,
      rows,
      ...(draft.value.mode === "advanced" && draft.value.expression
        ? { expression: draft.value.expression.trim() }
        : {}),
    };
  }

  store.setVisibility(Object.keys(next).length ? next : undefined);
  dialog.close();
  notify("显示隐藏条件已更新", "success");
}

function clear(): void {
  draft.value = { mode: "and", rows: [blankRow()], expression: "" };
}

function setMode(mode: ConditionMode): void {
  draft.value.mode = mode;
  if (mode === "advanced" && !draft.value.expression) {
    draft.value.expression = draft.value.rows.map((_, index) => index + 1).join(" and ");
  }
}
</script>

<template>
  <ModalShell
    v-if="dialog.visible.value && dialog.target.value"
    :title="title"
    width="680px"
    @close="dialog.close()"
  >
    <div class="cond__hint">
      命中「显示」条件时一定显示（优先于隐藏）；否则命中「隐藏」条件时隐藏。
      <br />{{ scopeTip }}
    </div>

    <div class="cond__section">条件间关系</div>
    <div class="cond__modes">
      <button
        v-for="option in CONDITION_MODE_OPTIONS"
        :key="option.value"
        type="button"
        class="cond__mode"
        :class="{ 'is-active': draft.mode === option.value }"
        @click="setMode(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="draft.mode === 'advanced'" class="cond__advanced">
      <input
        v-model="draft.expression"
        class="cond__expression wb-mono"
        type="text"
        spellcheck="false"
        placeholder="1 and (2 or 3)"
      />
      <div class="cond__tip" :class="{ 'is-error': expressionError }">
        {{ expressionError || "用条件序号组合，支持 and / or / not 与括号，序号从 1 开始。" }}
      </div>
    </div>

    <div class="cond__section">条件列表</div>
    <div class="cond__rows wb-scroll">
      <div v-for="(row, index) in draft.rows" :key="index" class="cond__row">
        <span class="cond__no">{{ index + 1 }}</span>

        <template v-if="!row.valueOnly">
          <select v-model="row.left" class="cond__select cond__left" aria-label="左元素">
            <option value="">选择元素</option>
            <option v-for="element in elements" :key="element.nodeId" :value="element.path">
              {{ element.label }}（{{ element.path }}）
            </option>
          </select>

          <select
            v-if="requiresAggregate(row.left)"
            v-model="row.aggregate"
            class="cond__select cond__aggregate"
            aria-label="聚合口径"
          >
            <option v-for="option in CONDITION_AGGREGATES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <select v-model="row.operator" class="cond__select cond__operator" aria-label="关系">
            <option v-for="option in CONDITION_OPERATOR_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <input
            v-if="!isUnary(row.operator)"
            v-model="row.value"
            class="cond__value"
            type="text"
            placeholder="值，或 &#123;&#123;路径&#125;&#125;"
          />
          <span v-else class="cond__value-placeholder">—</span>
        </template>

        <input
          v-else
          v-model="row.value"
          class="cond__value cond__value--only"
          type="text"
          placeholder="仅值：表达式或字面量，如 &#123;&#123;form.amount&#125;&#125; > 10"
        />

        <label class="cond__only" title="特殊场景：只填值，不设左元素与关系">
          <input type="checkbox" :checked="row.valueOnly" @change="toggleValueOnly(row)" />仅值
        </label>
        <button type="button" class="cond__del" aria-label="删除条件" @click="removeRow(index)">×</button>
      </div>
      <div v-if="!draft.rows.length" class="cond__empty">还没有条件，点击「添加条件」开始</div>
    </div>

    <button type="button" class="cond__add" @click="addRow">＋ 添加条件</button>

    <template #footer>
      <button type="button" class="cond__clear" @click="clear">清空</button>
      <span class="cond__spacer" />
      <button type="button" class="cond__cancel" @click="dialog.close()">取消</button>
      <button type="button" class="cond__ok" @click="save">确定</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.cond__hint {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wb-ink2);
}
.cond__section {
  margin: 14px 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wb-ink3);
}
.cond__modes {
  display: flex;
  gap: 6px;
}
.cond__mode {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 14px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.cond__mode.is-active {
  border-color: var(--wb-primary);
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
}
.cond__advanced {
  margin-top: 8px;
}
.cond__expression {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--wb-line);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--wb-ink);
}
.cond__tip {
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.cond__tip.is-error {
  color: var(--wb-danger);
}
.cond__rows {
  max-height: 260px;
  border: 1px solid var(--wb-line-soft);
  border-radius: 8px;
  background: #fbfcfe;
}
.cond__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--wb-line-soft);
  flex-wrap: wrap;
}
.cond__no {
  width: 20px;
  flex: none;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.cond__select,
.cond__value {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 7px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink);
  min-width: 0;
}
.cond__left {
  flex: 1 1 150px;
}
.cond__aggregate {
  flex: 0 0 78px;
}
.cond__operator {
  flex: 0 0 88px;
}
.cond__value {
  flex: 1 1 110px;
}
.cond__value--only {
  flex: 1 1 320px;
}
.cond__value-placeholder {
  flex: 1 1 110px;
  color: var(--wb-ink3);
}
.cond__only {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: none;
  font-size: 11px;
  color: var(--wb-ink2);
  cursor: pointer;
}
.cond__del {
  flex: none;
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  color: var(--wb-ink3);
  cursor: pointer;
}
.cond__del:hover {
  color: var(--wb-danger);
}
.cond__empty {
  padding: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.cond__add {
  margin-top: 8px;
  border: 1px dashed var(--wb-line);
  border-radius: 6px;
  background: #fff;
  padding: 6px 12px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.cond__clear,
.cond__cancel,
.cond__ok {
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.cond__clear,
.cond__cancel {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: var(--wb-ink2);
}
.cond__ok {
  border: 1px solid var(--wb-primary);
  background: var(--wb-primary);
  color: #fff;
}
.cond__spacer {
  flex: 1;
}
</style>
