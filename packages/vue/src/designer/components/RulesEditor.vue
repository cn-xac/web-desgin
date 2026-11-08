<script setup lang="ts">
/**
 * 校验规则编辑器。
 *
 * 规则存在 `node.rules`，与组件 props 解耦：
 * 同一套规则在 Vue / React / 静态 HTML 下语义一致。
 */
import { computed, ref } from "vue";
import {
  compilePattern,
  effectiveRules,
  getRuleDefinition,
  ruleMessage,
  ruleTypesFor,
  type RuleType,
  type ValidationRule,
} from "@x-ac/design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();

const node = computed(() => store.selectedNode);
const component = computed(() => node.value?.component ?? "");
const effectiveProps = computed(() => (node.value ? catalog.defaults(component.value, node.value.props) : {}));
const label = computed(() => String(effectiveProps.value.label ?? ""));
const rules = computed<ValidationRule[]>(() => (node.value ? effectiveRules(node.value, effectiveProps.value) : []));
const required = computed(() => rules.value.some((rule) => rule.type === "required"));

/** 可添加的规则类型：数字类不给长度规则，文本类不给数值规则 */
const availableTypes = computed(() =>
  ruleTypesFor(component.value)
    .filter((type) => type !== "required" && !rules.value.some((rule) => rule.type === type))
    .map((type) => ({
      value: type,
      label: getRuleDefinition(type)?.label ?? type,
    })),
);

/** 单条规则可切换的类型（required 只有它自己） */
function typeOptions(rule: ValidationRule): Array<{ label: string; value: string }> {
  const types = rule.type === "required" ? (["required"] as RuleType[]) : ruleTypesFor(component.value);
  return types.map((type) => ({ label: getRuleDefinition(type)?.label ?? type, value: type }));
}

function commit(next: ValidationRule[]): void {
  store.setRules(next);
}

function toggleRequired(value: boolean): void {
  const rest = rules.value.filter((rule) => rule.type !== "required");
  commit(value ? [{ type: "required" }, ...rest] : rest);
}

const addType = ref<RuleType | "">("");

function addRule(): void {
  const type = addType.value;
  if (!type) return;
  const definition = getRuleDefinition(type);
  const rule: ValidationRule = { type };
  if (definition?.valueKind === "length") rule.value = type === "minLength" ? 2 : 20;
  if (definition?.valueKind === "number") rule.value = type === "min" ? 0 : 100;
  if (definition?.valueKind === "regex") rule.value = "";
  addType.value = "";
  commit([...rules.value, rule]);
}

function changeType(index: number, type: RuleType): void {
  const definition = getRuleDefinition(type);
  const next: ValidationRule = { type };
  if (definition?.valueKind === "length") next.value = type === "minLength" ? 2 : 20;
  if (definition?.valueKind === "number") next.value = type === "min" ? 0 : 100;
  if (definition?.valueKind === "regex") next.value = "";
  commit(rules.value.map((rule, i) => (i === index ? next : rule)));
}

function patch(index: number, partial: Partial<ValidationRule>): void {
  commit(rules.value.map((rule, i) => (i === index ? { ...rule, ...partial } : rule)));
}

function setNumber(index: number, raw: unknown): void {
  const value = Number(raw);
  patch(index, { value: Number.isFinite(value) ? value : 0 });
}

function setText(index: number, raw: unknown): void {
  const value = String(raw ?? "");
  patch(index, value === "" ? { value: undefined } : { value });
}

function setFlags(index: number, raw: unknown): void {
  const value = String(raw ?? "").replace(/[^imsu]/g, "");
  patch(index, value ? { flags: value } : { flags: undefined });
}

function remove(index: number): void {
  commit(rules.value.filter((_rule, i) => i !== index));
}

function isInvalidRegex(rule: ValidationRule): boolean {
  if (rule.type !== "pattern" || !rule.value) return false;
  return compilePattern(String(rule.value), rule.flags ?? "") === null;
}

function preview(rule: ValidationRule): string {
  return ruleMessage(rule, label.value || "该项", component.value);
}
</script>

<template>
  <div v-if="node" class="rules">
    <div class="rules__head">
      <div>
        <div class="rules__title">校验规则</div>
        <div class="rules__sub">{{ label || "该字段" }} · {{ rules.length }} 条</div>
      </div>
      <UiControl as="Switch" :model-value="required" size="small" @update:model-value="toggleRequired" />
    </div>

    <div class="rules__hint">
      规则随 Schema 保存，运行时会自动执行；必填、长度、数值范围、正则都在这一处配置。
    </div>

    <div v-if="!rules.length" class="rules__empty">还没有规则，从下方添加一条</div>

    <div v-for="(rule, index) in rules" :key="`${rule.type}-${index}`" class="rule">
      <div class="rule__top">
        <UiControl
          as="Select"
          :model-value="rule.type"
          :options="typeOptions(rule)"
          size="small"
          :disabled="rule.type === 'required'"
          class="rule__type"
          @update:model-value="(value: unknown) => changeType(index, value as RuleType)"
        />

        <button class="rule__del" title="删除该规则" @click="remove(index)">×</button>
      </div>

      <div v-if="getRuleDefinition(rule.type)?.valueKind === 'number' || getRuleDefinition(rule.type)?.valueKind === 'length'" class="rule__value">
        <span class="rule__value-label">{{ getRuleDefinition(rule.type)?.valueLabel }}</span>
        <UiControl as="NumberInput"
          :model-value="Number(rule.value ?? 0)"
          :min="0"
          :controls="false"
          size="small"
          style="width: 100%"
          @update:model-value="(value: unknown) => setNumber(index, value)"
        />
      </div>

      <div v-else-if="getRuleDefinition(rule.type)?.valueKind === 'regex'" class="rule__regex">
        <UiControl as="Input"
          :model-value="String(rule.value ?? '')"
          size="small"
          placeholder="^\d{6}$"
          class="rule__regex-input"
          @update:model-value="(value: unknown) => setText(index, value)"
        >
          <template #prepend>/</template>
          <template #append>/{{ rule.flags ?? "" }}</template>
        </UiControl>
        <UiControl as="Input"
          :model-value="rule.flags ?? ''"
          size="small"
          placeholder="imsu"
          class="rule__flags"
          @update:model-value="(value: unknown) => setFlags(index, value)"
        />
      </div>

      <div v-if="isInvalidRegex(rule)" class="rule__error">正则无法编译，请检查括号与转义</div>

      <UiControl as="Input"
        :model-value="rule.message ?? ''"
        size="small"
        class="rule__message"
        :placeholder="`默认提示：${preview(rule)}`"
        @update:model-value="(value: unknown) => patch(index, String(value ?? '').trim() ? { message: String(value) } : { message: undefined })"
      />

      <div class="rule__when">
        <UiControl as="Input"
          :model-value="rule.when ?? ''"
          size="small"
          placeholder="生效条件（可选），如 {{form.type}} === 'company'"
          @update:model-value="(value: unknown) => patch(index, String(value ?? '').trim() ? { when: String(value) } : { when: undefined })"
        />
      </div>

      <div class="rule__preview">{{ preview(rule) }}</div>
    </div>

    <UiControl
      v-if="availableTypes.length"
      as="Select"
      v-model="addType"
      :options="availableTypes"
      size="small"
      class="rules__add"
      placeholder="+ 添加规则"
      @update:model-value="addRule"
    />

    <div class="rules__tip">
      空值只由「必填」拦截；其余规则在字段为空时跳过，避免同一个空格子报两条错。
    </div>
  </div>
</template>

<style scoped>
.rules {
  padding: 12px 14px 20px;
}
.rules__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.rules__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink);
}
.rules__sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--wb-ink3);
}
.rules__hint {
  padding: 7px 9px;
  margin-bottom: 12px;
  border: 1px solid var(--wb-line-soft);
  border-radius: 6px;
  background: #fafbfd;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--wb-ink3);
}
.rules__empty {
  padding: 14px 0;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.rule {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  background: #fff;
}
.rule__top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.rule__type {
  flex: 1;
}
.rule__del {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.rule__del:hover {
  background: #fef0f0;
  color: var(--wb-danger);
}
.rule__value {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rule__value-label {
  flex: 0 0 52px;
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.rule__regex {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.rule__regex-input {
  flex: 1;
}
.rule__flags {
  flex: 0 0 62px;
}
.rule__message {
  margin-bottom: 6px;
}
.rule__error {
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--wb-danger);
}
.rule__preview {
  font-size: 11px;
  color: var(--wb-ink3);
}
.rules__add {
  width: 100%;
  margin-top: 4px;
}
.rules__tip {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.6;
  color: #a8b0c0;
}
</style>
