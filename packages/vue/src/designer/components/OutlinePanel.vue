<script setup lang="ts">
/**
 * 组件管理器（大纲面板）。
 * - 「组件树」tab：按树形列出整页节点，点得到、看得见层级、能拖、能删；
 * - 「特殊设置」tab（#6）：列出带外部数据源 / 显示隐藏 / 校验 / 事件的节点，
 *   直观展示哪些元素用了什么特殊配置，点行即选中定位。
 *
 * 选中联动是双向的：树里点 → 画布选中并滚动到位；画布点 → 树自动展开祖先。
 */
import { computed, nextTick, ref, watch } from "vue";
import { collectSpecialSettings, getBreadcrumb, type SpecialSettingItem } from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import OutlineTree from "./OutlineTree.vue";

const store = useDesignerStore();

const roots = computed(() => store.page.children ?? []);
const expanded = ref(new Set<string>());

type Tab = "tree" | "settings";
const tab = ref<Tab>("tree");

const settings = computed<SpecialSettingItem[]>(() => collectSpecialSettings(store.page, { registry: store.catalog }));

/** 画布点选深处节点时，自动展开它的祖先并滚到对应行；选中的容器自己也展开 */
watch(
  () => store.selectedId,
  (id) => {
    if (!id) return;
    const trail = getBreadcrumb(store.page.children, id);
    for (const node of trail) {
      if (node.id !== id) expanded.value.add(node.id);
    }
    const leaf = trail[trail.length - 1];
    if (leaf?.children?.length) expanded.value.add(leaf.id);
    void nextTick(() => {
      const row = document.querySelector(`[data-outline-id="${id}"]`);
      row?.scrollIntoView?.({ block: "nearest" });
    });
  },
  { immediate: true },
);

/* ---------------- 根节点行：接收「扔到页面最外层」的拖放 ---------------- */

const dragging = computed(() => store.dragPayload !== null);
const rootHint = computed(() => dragging.value && store.dropHint?.id === null);

function onRootDragOver(event: DragEvent): void {
  event.preventDefault();
  store.setDropHint({ id: null, position: "inside" });
}

function onRootDrop(event: DragEvent): void {
  event.preventDefault();
  store.applyDrop({ id: null, position: "inside" });
}

/* ---------------- 特殊设置 tab ---------------- */

function selectSetting(item: SpecialSettingItem): void {
  store.select(item.nodeId);
  const target = document.querySelector(`[data-node-id="${item.nodeId}"]`);
  target?.scrollIntoView?.({ block: "nearest" });
}
</script>

<template>
  <aside class="opanel">
    <div class="opanel__head">
      <div class="opanel__tabs">
        <button
          type="button"
          class="opanel__tab"
          :class="{ 'is-on': tab === 'tree' }"
          @click="tab = 'tree'"
        >
          组件树
        </button>
        <button
          type="button"
          class="opanel__tab"
          :class="{ 'is-on': tab === 'settings' }"
          @click="tab = 'settings'"
        >
          特殊设置
          <span v-if="settings.length" class="opanel__tab-count">{{ settings.length }}</span>
        </button>
      </div>
    </div>

    <!-- 组件树 -->
    <div v-show="tab === 'tree'" class="opanel__scroll wb-scroll">
      <div
        class="opanel__root"
        :class="{ 'is-hint-inside': rootHint }"
        title="页面根：拖到这里放到最外层"
        @click="store.select(null)"
        @dragover="onRootDragOver"
        @dragleave="() => store.setDropHint(null)"
        @drop="onRootDrop"
      >
        <span class="opanel__root-icon">📄</span>
        <span class="opanel__root-name">页面</span>
      </div>

      <OutlineTree v-if="roots.length" :nodes="roots" :depth="0" :expanded="expanded" />
      <div v-else class="opanel__empty">画布还是空的，从左侧拖入或点击组件</div>
    </div>

    <!-- 特殊设置 -->
    <div v-show="tab === 'settings'" class="opanel__scroll wb-scroll">
      <div v-if="!settings.length" class="opanel__empty">
        还没有特殊设置。<br />配置了外部数据源、显示 / 隐藏、校验或事件的元素会列在这里。
      </div>
      <ul v-else class="oset">
        <li
          v-for="item in settings"
          :key="item.nodeId"
          class="oset__row"
          :class="{ 'is-sel': store.selectedId === item.nodeId }"
          :data-outline-id="item.nodeId"
          @click="selectSetting(item)"
          @mouseenter="store.hover(item.nodeId)"
          @mouseleave="store.hover(null)"
        >
          <span class="oset__name" :title="item.label">{{ item.label }}</span>
          <span class="oset__flags">
            <span v-if="item.flags.external" class="oset__flag oset__flag--ext" title="外部数据源">源</span>
            <span v-if="item.flags.visibility" class="oset__flag oset__flag--vis" title="显示 / 隐藏">隐</span>
            <span v-if="item.flags.rules" class="oset__flag oset__flag--rule" title="数据校验">验</span>
            <span v-if="item.flags.events" class="oset__flag oset__flag--evt" title="事件">事</span>
          </span>
        </li>
      </ul>
    </div>

    <div class="opanel__foot">点击选中 · 悬停高亮 · 拖拽调整层级</div>
  </aside>
</template>

<style scoped>
.opanel {
  display: flex;
  flex-direction: column;
  width: 208px;
  background: #fff;
  border-right: 1px solid var(--wb-line);
}
.opanel__head {
  display: flex;
  align-items: center;
  padding: 7px 8px;
  border-bottom: 1px solid var(--wb-line-soft);
}
.opanel__tabs {
  display: flex;
  gap: 4px;
  width: 100%;
}
.opanel__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--wb-ink3);
  cursor: pointer;
  font-family: inherit;
}
.opanel__tab.is-on {
  border-color: var(--wb-primary);
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
}
.opanel__tab-count {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--wb-primary);
  color: #fff;
  font-size: 10px;
  line-height: 15px;
}
.opanel__scroll {
  flex: 1;
  padding: 6px 6px 12px;
}
.opanel__root {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 5px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
  user-select: none;
}
.opanel__root:hover {
  background: var(--wb-bg);
}
.opanel__root.is-hint-inside {
  outline: 1px dashed var(--wb-primary);
  outline-offset: -2px;
  background: var(--wb-primary-soft);
}
.opanel__root-icon {
  flex: 0 0 16px;
  text-align: center;
  font-size: 12px;
  opacity: 0.75;
}
.opanel__root-name {
  flex: 1;
}
.opanel__empty {
  padding: 18px 10px;
  font-size: 12px;
  color: var(--wb-ink3);
  line-height: 1.6;
}
.opanel__foot {
  padding: 8px 10px;
  border-top: 1px solid var(--wb-line-soft);
  font-size: 11px;
  color: var(--wb-ink3);
  line-height: 1.5;
}
/* 特殊设置列表 */
.oset {
  margin: 0;
  padding: 0;
  list-style: none;
}
.oset__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
  user-select: none;
}
.oset__row:hover {
  background: var(--wb-bg);
}
.oset__row.is-sel {
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
  font-weight: 600;
}
.oset__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oset__flags {
  display: flex;
  gap: 2px;
  flex: 0 0 auto;
}
.oset__flag {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: #fff;
}
.oset__flag--ext {
  background: #2f4bff;
}
.oset__flag--vis {
  background: #16a34a;
}
.oset__flag--rule {
  background: #d97706;
}
.oset__flag--evt {
  background: #9333ea;
}
</style>
