<script setup lang="ts">
/**
 * 可绑定数据选择器（ruUqAF）。
 *
 * 「快速选择可绑定数据」的落点：列出当前页面**能绑**的数据，点一条即完成绑定。
 * 清单由 core 的 collectBindableData 从页面 Schema 生成，
 * 与运行时的绑定规则严格对齐（显式 modelValue > form.<节点ID> > 页面状态 / 数据源键）。
 *
 * 弹窗只负责「选」与「写」，不关心被绑的是哪个组件 —— 落点由 dialogs.ts 的 target 决定。
 */
import { computed } from "vue";
import { collectBindableData, filterBindableData, findLocation, groupBindableData } from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import { useBindingPicker } from "../dialogs";
import ModalShell from "../ui/ModalShell.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const picker = useBindingPicker();

/** 清单随页面变化实时重算：设计期一直在改 Schema，缓存会立刻过期 */
const all = computed(() => collectBindableData(store.page, { registry: catalog }));
const matched = computed(() => filterBindableData(all.value, picker.keyword.value));
const groups = computed(() => groupBindableData(matched.value));

/** 当前属性已绑定的路径（用于高亮 + 清除） */
const currentPath = computed(() => {
  const target = picker.target.value;
  if (!target) return "";
  const node = findLocation(store.page.children, target.nodeId)?.node;
  if (!node) return "";
  const raw = target.where === "props" ? node.props?.[target.key] : node.style?.[target.key];
  const text = String(raw ?? "");
  const match = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(text);
  return match ? match[1] : "";
});

function pick(path: string): void {
  const target = picker.target.value;
  if (!target) return;
  if (target.where === "props") store.updateProp(target.key, `{{${path}}}`);
  else store.updateStyle(target.key, `{{${path}}}`);
  picker.close();
}

/** 清除绑定：props 直接删键回落默认值，style 删键回落默认样式 */
function unbind(): void {
  const target = picker.target.value;
  if (!target) return;
  if (target.where === "props") store.updateProp(target.key, undefined);
  else store.updateStyle(target.key, "");
  picker.close();
}
</script>

<template>
  <ModalShell
    v-if="picker.visible.value && picker.target.value"
    title="选择可绑定数据"
    width="560px"
    @close="picker.close()"
  >
    <div class="picker">
      <input
        v-model="picker.keyword.value"
        class="picker__search"
        type="search"
        placeholder="搜索名称或路径，如 姓名 / form.name"
        spellcheck="false"
      />

      <div v-if="!groups.length" class="picker__empty">
        当前页面还没有可绑定的数据。可先在「页面设置」里加页面状态，或给某个表单控件设值。
      </div>

      <div v-else class="picker__list wb-scroll">
        <section v-for="group in groups" :key="group.group" class="picker__group">
          <div class="picker__group-name">{{ group.group }}（{{ group.items.length }}）</div>
          <button
            v-for="item in group.items"
            :key="item.path"
            type="button"
            class="picker__item"
            :class="{ 'is-active': item.path === currentPath }"
            @click="pick(item.path)"
          >
            <span class="picker__item-label">{{ item.label }}</span>
            <span class="picker__item-path">{{ item.path }}</span>
            <span v-if="item.hint" class="picker__item-hint">{{ item.hint }}</span>
          </button>
        </section>
      </div>
    </div>

    <template #footer>
      <button
        v-if="currentPath"
        type="button"
        class="picker__unbind"
        @click="unbind"
      >
        清除绑定（{{ currentPath }}）
      </button>
      <span class="picker__spacer" />
      <button type="button" class="picker__cancel" @click="picker.close()">取消</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 320px;
}
.picker__search {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--wb-line);
  border-radius: 6px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--wb-ink);
}
.picker__search:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
.picker__list {
  flex: 1;
  min-height: 0;
  max-height: 46vh;
  border: 1px solid var(--wb-line-soft);
  border-radius: 8px;
  padding: 4px;
}
.picker__group {
  margin-bottom: 8px;
}
.picker__group-name {
  padding: 6px 8px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wb-ink3);
}
.picker__item {
  display: grid;
  grid-template-columns: minmax(80px, auto) minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.picker__item:hover {
  background: var(--wb-primary-soft);
}
.picker__item.is-active {
  background: var(--wb-primary-soft);
  box-shadow: inset 2px 0 0 var(--wb-primary);
}
.picker__item-label {
  font-size: 12.5px;
  color: var(--wb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker__item-path {
  font-family: var(--wb-mono);
  font-size: 11.5px;
  color: var(--wb-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker__item-hint {
  font-size: 11px;
  color: var(--wb-ink3);
  white-space: nowrap;
}
.picker__empty {
  padding: 28px 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--wb-ink3);
  line-height: 1.7;
}
.picker__unbind {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.picker__unbind:hover {
  border-color: var(--wb-danger);
  color: var(--wb-danger);
}
.picker__spacer {
  flex: 1;
}
.picker__cancel {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
</style>
