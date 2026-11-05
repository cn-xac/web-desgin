<script setup lang="ts">
/**
 * 组件管理器（大纲面板）。容器 / 栅格在画布里不好选中，
 * 这里按树形列出整页节点：点得到、看得见层级、能拖、能删。
 *
 * 选中联动是双向的：树里点 → 画布选中并滚动到位；
 * 画布点 → 树自动展开祖先并滚到对应行。
 */
import { computed, nextTick, ref, watch } from "vue";
import { getBreadcrumb } from "@x-ac/design-core";
import { useDesignerStore } from "../store";
import OutlineTree from "./OutlineTree.vue";

const store = useDesignerStore();

const roots = computed(() => store.page.children ?? []);
const expanded = ref(new Set<string>());

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
</script>

<template>
  <aside class="opanel">
    <div class="opanel__head">
      <span>组件树</span>
      <span class="opanel__count">{{ store.nodeCount }}</span>
    </div>

    <div class="opanel__scroll wb-scroll">
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
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wb-line-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--wb-ink3);
}
.opanel__count {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--wb-bg);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
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
</style>
