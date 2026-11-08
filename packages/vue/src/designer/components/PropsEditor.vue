<script setup lang="ts">
import { computed, reactive, type Component } from "vue";
import type { PropField, PropFieldGroup } from "@x-ac/design-core";
import { FIELD_GROUP_LABELS, fieldOptions, groupFields } from "@x-ac/design-core";
import UiControl from "../ui/UiControl.vue";
import { useMaterialCatalog } from "../../materials/catalog";
import { useDesignerStore } from "../store";
import { useNotify } from "../ui/kit";
import { useUiAdapter } from "../../renderer/context";

const notify = useNotify();

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const uiAdapter = useUiAdapter();

/**
 * 字段编辑器覆盖：适配包可以用自己库的控件替换某一类字段的编辑器。
 * 契约只要求「接受 modelValue、抛 update:modelValue」，所以引擎给的是同一份绑定。
 *
 * 刻意不做成 computed：computed 会把组件对象包成 reactive 代理，
 * Vue 会为此报「component made a reactive object」告警，且带来无谓的代理开销。
 */
function editorFor(field: PropField): Component | null {
  if (field.type === "columns") return null; // 结构化编辑器由引擎内置，不走覆盖
  return (uiAdapter?.editors?.[field.type] as Component | undefined) ?? null;
}

const node = computed(() => store.selectedNode);
const material = computed(() => (node.value ? catalog.get(node.value.component) : undefined));
const effective = computed(() => (node.value ? catalog.defaults(node.value.component, node.value.props) : {}));
const customKeys = computed(() => new Set(Object.keys(node.value?.props ?? {})));
const stateKeys = computed(() => Object.keys(store.page.state ?? {}));

/**
 * 分组折叠状态：`advanced` 默认收起。
 * UI 库组件动辄二十几个属性，全平铺会让面板变成需要不停滚动的长列表，
 * 而其中大半（autofocus / tabindex / nativeType）一年也改不到一次。
 */
const collapsed = reactive<Record<PropFieldGroup, boolean>>({
  basic: false,
  content: false,
  data: false,
  style: false,
  advanced: true,
});

const sections = computed(() => (material.value ? groupFields(material.value.fields) : []));

function toggle(group: PropFieldGroup): void {
  collapsed[group] = !collapsed[group];
}

function value(key: string): unknown {
  return effective.value[key];
}

function isCustom(key: string): boolean {
  return customKeys.value.has(key);
}

function isBound(input: unknown): boolean {
  return typeof input === "string" && input.includes("{{");
}

function set(key: string, next: unknown): void {
  store.updateProp(key, next);
}

interface ColumnItem {
  label: string;
  prop: string;
}

function columnsOf(key: string): ColumnItem[] {
  const raw = value(key);
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return { label: String(record.label ?? ""), prop: String(record.prop ?? "") };
    });
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [label, prop] = pair.split(":").map((part) => part.trim());
        return { label: label || prop || "", prop: prop || label || "" };
      });
  }
  return [];
}

function writeColumns(key: string, next: ColumnItem[]): void {
  set(key, next);
}

function updateColumn(key: string, index: number, field: "label" | "prop", next: string): void {
  const list = columnsOf(key).slice();
  list[index] = { ...list[index], [field]: next };
  writeColumns(key, list);
}

function addColumn(key: string): void {
  writeColumns(key, [...columnsOf(key), { label: "新列", prop: `field${columnsOf(key).length + 1}` }]);
}

function removeColumn(key: string, index: number): void {
  const list = columnsOf(key).slice();
  list.splice(index, 1);
  writeColumns(key, list);
}

function insertBinding(key: string, path: string): void {
  set(key, `{{${path}}}`);
}

function copyId(): void {
  if (!node.value) return;
  void navigator.clipboard?.writeText(node.value.id);
  notify("已复制节点 ID", "success");
}
</script>

<template>
  <div v-if="material" class="props">
    <div class="props__head">
      <span class="props__chip">{{ material.title }}</span>
      <span class="props__id" :title="node?.id" @click="copyId">{{ node?.id }}</span>
    </div>

    <div v-if="material.hint" class="props__hint">{{ material.hint }}</div>

    <section v-for="section in sections" :key="section.group" class="props__group">
      <button
        class="props__group-head"
        :class="{ 'is-collapsed': collapsed[section.group] }"
        type="button"
        @click="toggle(section.group)"
      >
        <span class="props__group-arrow">▾</span>
        <span class="props__group-name">{{ FIELD_GROUP_LABELS[section.group] }}</span>
        <span class="props__group-count">{{ section.fields.length }}</span>
      </button>

      <div v-show="!collapsed[section.group]" class="props__group-body">
        <div v-for="field in section.fields" :key="field.key" class="props__row">
          <div class="props__label">
            <span>{{ field.label }}</span>
            <span v-if="isCustom(field.key)" class="props__dot" title="与默认值不同，会写入 Schema">●</span>
            <span v-if="isBound(value(field.key))" class="props__bind">绑定</span>
          </div>

          <!-- 适配包覆盖优先：给了就用它的控件，没给走下面的内置实现 -->
          <component
            v-if="editorFor(field)"
            :is="editorFor(field)"
            :model-value="value(field.key)"
            :field="field"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <UiControl as="Switch"
            v-else-if="field.type === 'boolean'"
            :model-value="Boolean(value(field.key))"
            size="small"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <UiControl as="NumberInput"
            v-else-if="field.type === 'number'"
            :model-value="Number(value(field.key) ?? 0)"
            :controls="false"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            size="small"
            style="width: 100%"
            @update:model-value="(v: unknown) => set(field.key, Number(v ?? 0))"
          />

          <UiControl
            v-else-if="field.type === 'select'"
            as="Select"
            :model-value="value(field.key) as string | number"
            :options="fieldOptions(field)"
            size="small"
            style="width: 100%"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <!-- 取色：业务物料的主题色 / 标签色都靠它，缺了只能手写十六进制 -->
          <UiControl as="ColorInput"
            v-else-if="field.type === 'color'"
            :model-value="String(value(field.key) ?? '')"
            size="small"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <UiControl as="Input"
            v-else-if="field.type === 'textarea'"
            type="textarea"
            :rows="3"
            size="small"
            :model-value="String(value(field.key) ?? '')"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <UiControl as="Input"
            v-else-if="field.type === 'text' || field.type === 'options'"
            size="small"
            :model-value="String(value(field.key) ?? '')"
            @update:model-value="(v: unknown) => set(field.key, v)"
          />

          <template v-if="field.type === 'columns'">
            <div class="columns">
              <div v-for="(column, index) in columnsOf(field.key)" :key="index" class="columns__row">
                <UiControl as="Input"
                  size="small"
                  :model-value="column.label"
                  placeholder="列名"
                  @update:model-value="(v: unknown) => updateColumn(field.key, index, 'label', String(v))"
                />
                <UiControl as="Input"
                  size="small"
                  :model-value="column.prop"
                  placeholder="字段"
                  @update:model-value="(v: unknown) => updateColumn(field.key, index, 'prop', String(v))"
                />
                <button class="columns__del" title="删除该列" @click="removeColumn(field.key, index)">×</button>
              </div>
              <UiControl as="Button" size="small" text type="primary" @click="addColumn(field.key)">+ 添加列</UiControl>
            </div>
          </template>

          <div v-if="field.tip" class="props__tip">{{ field.tip }}</div>

          <div v-if="field.key === 'modelValue' && stateKeys.length" class="props__vars">
            <span class="props__vars-label">可用变量</span>
            <button v-for="key in stateKeys" :key="key" class="props__var" @click="insertBinding('modelValue', `${key}.`)">
              {{ key }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <div v-if="!material.fields.length" class="props__empty">该组件没有可配置属性</div>
  </div>
</template>

<style scoped>
.props {
  padding: 12px 14px 20px;
}
.props__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.props__chip {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-primary);
  background: var(--wb-primary-soft);
  border-radius: 4px;
  padding: 2px 7px;
}
.props__id {
  font-family: var(--wb-mono);
  font-size: 11px;
  color: var(--wb-ink3);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.props__hint {
  font-size: 12px;
  color: var(--wb-ink3);
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 6px;
  padding: 7px 9px;
  margin-bottom: 12px;
  line-height: 1.6;
}
.props__row {
  margin-bottom: 14px;
}
.props__group {
  margin-bottom: 4px;
}
.props__group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 0;
  border: none;
  border-bottom: 1px solid var(--wb-line-soft);
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--wb-ink3);
  text-align: left;
  cursor: pointer;
}
.props__group-head:hover {
  color: var(--wb-text);
}
.props__group-arrow {
  display: inline-block;
  font-size: 9px;
  transition: transform 0.12s ease;
}
.props__group-head.is-collapsed .props__group-arrow {
  transform: rotate(-90deg);
}
.props__group-name {
  flex: 1;
}
.props__group-count {
  font-weight: 500;
  color: var(--wb-ink3);
  background: var(--wb-bg-soft, #f2f4f8);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 16px;
}
.props__group-body {
  padding-top: 10px;
}
.props__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink2);
}
.props__dot {
  color: var(--wb-warning);
  font-size: 8px;
}
.props__bind {
  font-size: 10px;
  font-weight: 500;
  color: var(--wb-primary);
  border: 1px solid #dfe4ff;
  border-radius: 3px;
  padding: 0 3px;
}
.props__tip {
  margin-top: 4px;
  font-size: 11px;
  color: var(--wb-ink3);
  line-height: 1.5;
}
.props__vars {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.props__vars-label {
  font-size: 11px;
  color: var(--wb-ink3);
}
.props__var {
  border: 1px solid var(--wb-line);
  background: #fff;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 11px;
  font-family: var(--wb-mono);
  color: var(--wb-ink2);
  cursor: pointer;
}
.props__var:hover {
  border-color: var(--wb-primary);
  color: var(--wb-primary);
}
.props__empty {
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.columns {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.columns__row {
  display: grid;
  grid-template-columns: 1fr 1fr 22px;
  gap: 6px;
  align-items: center;
}
.columns__del {
  border: none;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}
.columns__del:hover {
  color: var(--wb-danger);
}

/* 属性字段数由适配包决定（core 119 / EP 更多），行数不固定：
   窄屏收敛留白，超长时面板自身可滚动，避免把画布挤出视口。 */
@media (max-width: 1100px) {
  .props {
    padding: 10px 10px 16px;
  }
  .props__row {
    margin-bottom: 10px;
    padding: 6px 8px;
  }
}
@media (max-width: 720px) {
  .props {
    max-height: 60vh;
    overflow-y: auto;
  }
  .props__row {
    margin-bottom: 8px;
  }
}
</style>
