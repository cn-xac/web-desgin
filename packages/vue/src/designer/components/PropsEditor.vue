<script setup lang="ts">
import { computed } from "vue";
import UiControl from "../ui/UiControl.vue";
import { useMaterialCatalog } from "../../materials/catalog";
import { useDesignerStore } from "../store";
import { useNotify } from "../ui/kit";

const notify = useNotify();

const store = useDesignerStore();
const catalog = useMaterialCatalog();

const node = computed(() => store.selectedNode);
const material = computed(() => (node.value ? catalog.get(node.value.component) : undefined));
const effective = computed(() => (node.value ? catalog.defaults(node.value.component, node.value.props) : {}));
const customKeys = computed(() => new Set(Object.keys(node.value?.props ?? {})));
const stateKeys = computed(() => Object.keys(store.page.state ?? {}));

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

    <div v-for="field in material.fields" :key="field.key" class="props__row">
      <div class="props__label">
        <span>{{ field.label }}</span>
        <span v-if="isCustom(field.key)" class="props__dot" title="与默认值不同，会写入 Schema">●</span>
        <span v-if="isBound(value(field.key))" class="props__bind">绑定</span>
      </div>

      <UiControl as="Switch"
        v-if="field.type === 'boolean'"
        :model-value="Boolean(value(field.key))"
        size="small"
        @update:model-value="(v: unknown) => set(field.key, v)"
      />

      <UiControl as="NumberInput"
        v-else-if="field.type === 'number'"
        :model-value="Number(value(field.key) ?? 0)"
        :controls="false"
        size="small"
        style="width: 100%"
        @update:model-value="(v: unknown) => set(field.key, Number(v ?? 0))"
      />

      <UiControl
        v-else-if="field.type === 'select'"
        as="Select"
        :model-value="value(field.key) as string | number"
        :options="(field.options ?? []).map((option) => ({ label: String(option), value: option }))"
        size="small"
        style="width: 100%"
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
  color: var(--el-color-warning);
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
  color: var(--el-color-danger);
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
