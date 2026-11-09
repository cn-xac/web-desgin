<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { materialKey } from "@x-ac/design-core";
import { useMaterialCatalog } from "../../materials/catalog";
import { UI_ADAPTER } from "../../renderer/context";
import { useDesignerStore } from "../store";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const keyword = ref("");

/**
 * 当前适配包的组件表。
 *
 * 物料目录（catalog）与组件表（components）是两个来源：前者描述「有哪些物料」，
 * 后者描述「当前这个 UI 库实现了哪些」。切库后 Schema 里可能残留别的库的物料，
 * 这类物料要置灰——能看见、能理解，但不允许再拖进来。
 */
const adapter = inject(UI_ADAPTER, null);

function unavailable(component: string): boolean {
  const components = adapter?.components;
  // 没注入适配包时不拦：渲染器那边会统一降级为占位，面板再全灰只会让人没法操作
  if (!components) return false;
  // 子表单（kind=subform）由引擎按结构渲染，不需要 UI 库提供组件实现，永远可拖入
  if (catalog.get(component)?.kind === "subform") return false;
  return !(materialKey(component) in components) && !(component in components);
}

const groups = computed(() => {
  const all = catalog.byCategory();
  const key = keyword.value.trim().toLowerCase();
  if (!key) return all;
  return all
    .map((group) => ({
      category: group.category,
      items: group.items.filter(
        (item) => item.title.toLowerCase().includes(key) || item.component.toLowerCase().includes(key),
      ),
    }))
    .filter((group) => group.items.length > 0);
});

const unavailableCount = computed(() =>
  groups.value.reduce((sum, group) => sum + group.items.filter((item) => unavailable(item.component)).length, 0),
);

function itemTitle(title: string, hint: string | undefined, component: string): string {
  if (unavailable(component)) return `${title}：当前 UI 库未提供该物料，换适配包后再用`;
  return hint ?? title;
}

function onAdd(component: string): void {
  if (unavailable(component)) return;
  store.addNodeSmart(component);
}

function onDragStart(event: DragEvent, component: string): void {
  if (unavailable(component)) {
    event.preventDefault();
    return;
  }
  store.beginDrag({ kind: "new", component });
  if (!event.dataTransfer) return;
  event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "new", component }));
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <aside class="palette">
    <div class="palette__search">
      <UiControl as="Input" v-model="keyword" size="small" placeholder="搜索组件" clearable />
    </div>

    <div class="palette__scroll wb-scroll">
      <section v-for="group in groups" :key="group.category" class="palette__group">
        <div class="palette__title">{{ group.category }}</div>
        <div
          v-for="item in group.items"
          :key="item.component"
          class="palette__item"
          :class="{ 'is-disabled': unavailable(item.component) }"
          :draggable="!unavailable(item.component)"
          :title="itemTitle(item.title, item.hint, item.component)"
          @dragstart="onDragStart($event, item.component)"
          @dragend="store.clearDrag()"
          @click="onAdd(item.component)"
        >
          <span class="palette__icon">{{ item.icon }}</span>
          <span class="palette__name">{{ item.title }}</span>
          <span v-if="item.owner === 'user'" class="palette__own" title="业务物料：宿主注册，跨库可移植性由注册者负责">自</span>
        </div>
      </section>

      <div v-if="!groups.length" class="palette__empty">没有匹配的组件</div>
    </div>

    <div class="palette__foot">
      拖入画布，或点击添加到选中容器
      <template v-if="unavailableCount">
        <br />灰色物料当前 UI 库未实现，换适配包后可用（{{ unavailableCount }} 个）
      </template>
    </div>
  </aside>
</template>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  width: 196px;
  background: #fff;
  border-right: 1px solid var(--wb-line);
}
.palette__search {
  padding: 10px;
  border-bottom: 1px solid var(--wb-line-soft);
}
.palette__scroll {
  flex: 1;
  padding: 6px 8px 20px;
}
.palette__group {
  margin-bottom: 8px;
}
.palette__title {
  padding: 8px 6px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--wb-ink3);
}
.palette__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-ink2);
  cursor: grab;
  user-select: none;
  transition: background 0.12s ease, color 0.12s ease;
}
.palette__item:hover {
  background: var(--wb-primary-soft);
  border-color: #dfe4ff;
  color: var(--wb-primary);
}
.palette__item:active {
  cursor: grabbing;
}
/* 当前 UI 库没有实现的物料：看得见、拖不动、点不了 */
.palette__item.is-disabled,
.palette__item.is-disabled:hover {
  background: transparent;
  border-color: transparent;
  color: var(--wb-ink3);
  opacity: 0.45;
  cursor: not-allowed;
}
.palette__icon {
  width: 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}
.palette__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 业务物料标记：与官方物料区分，避免「以为能跨库用」 */
.palette__own {
  margin-left: auto;
  flex: none;
  padding: 0 3px;
  border: 1px solid var(--wb-line);
  border-radius: 3px;
  font-size: 10px;
  line-height: 14px;
  color: var(--wb-ink3);
}
.palette__empty {
  padding: 24px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.palette__foot {
  padding: 8px 10px;
  border-top: 1px solid var(--wb-line-soft);
  font-size: 11px;
  color: var(--wb-ink3);
  line-height: 1.5;
}
</style>
