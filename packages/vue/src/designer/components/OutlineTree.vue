<script setup lang="ts">
/**
 * 组件树（递归）。设计器的「组件管理器」主体：
 * 容器 / 栅格加了以后在画布里不好点，这里给一棵永远点得到的树。
 *
 * 能力：点击选中（双向同步画布）、悬停高亮画布、拖拽调整层级与顺序、
 * 行内复制 / 删除。拖拽复用画布同一套 dropHint / applyDrop 链路，
 * 所以「从物料面板拖新组件扔到树上某一行」也是合法操作。
 */
import type { NodeSchema } from "@x-ac/design-core";
import { getMaterial } from "@x-ac/design-core";
import { useDesignerStore } from "../store";

const props = defineProps<{
  nodes: NodeSchema[];
  depth: number;
  /** 展开的容器 id 集合（由 OutlinePanel 统一持有，方便自动展开祖先） */
  expanded: Set<string>;
}>();

const store = useDesignerStore();

function materialOf(node: NodeSchema) {
  return getMaterial(node.component);
}

function labelOf(node: NodeSchema): string {
  const material = materialOf(node);
  const summary = material?.textProp ? String(node.props?.[material.textProp] ?? "").trim() : "";
  const text = summary ? ` · ${summary.slice(0, 12)}` : "";
  return `${material?.title ?? node.component}${text}`;
}

function hasChildren(node: NodeSchema): boolean {
  return Boolean(node.children?.length);
}

function toggle(node: NodeSchema): void {
  if (!hasChildren(node)) return;
  if (props.expanded.has(node.id)) props.expanded.delete(node.id);
  else props.expanded.add(node.id);
}

/* ---------------- 选中 / 行内操作 ---------------- */

function selectRow(node: NodeSchema): void {
  store.select(node.id);
  // 让画布滚到对应节点：容器嵌套很深时这是唯一不用肉眼找的办法
  const target = document.querySelector(`[data-node-id="${node.id}"]`);
  target?.scrollIntoView?.({ block: "nearest" });
}

function copyRow(node: NodeSchema): void {
  store.select(node.id);
  store.duplicateSelected();
}

function removeRow(node: NodeSchema): void {
  store.select(node.id);
  store.removeSelected();
}

/* ---------------- 拖拽（与画布同一套 hint / applyDrop） ---------------- */

function hintFor(node: NodeSchema): "inside" | "before" | "after" | null {
  return store.dropHint?.id === node.id ? store.dropHint.position : null;
}

function positionFromEvent(event: DragEvent, node: NodeSchema): "inside" | "before" | "after" {
  const element = event.currentTarget as HTMLElement | null;
  if (!element) return "after";
  const rect = element.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);

  if (materialOf(node)?.acceptsChildren) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

function onDragStart(event: DragEvent, node: NodeSchema): void {
  event.stopPropagation();
  event.dataTransfer?.setData("text/plain", JSON.stringify({ kind: "move", id: node.id }));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  store.beginDrag({ kind: "move", id: node.id });
}

function onDragOver(event: DragEvent, node: NodeSchema): void {
  event.preventDefault();
  event.stopPropagation();
  store.setDropHint({ id: node.id, position: positionFromEvent(event, node) });
}

function onDragLeave(node: NodeSchema): void {
  if (store.dropHint?.id === node.id) store.setDropHint(null);
}

function onDrop(event: DragEvent, node: NodeSchema): void {
  event.preventDefault();
  event.stopPropagation();
  store.applyDrop({ id: node.id, position: positionFromEvent(event, node) });
}
</script>

<template>
  <ul class="otree" :class="{ 'otree--root': depth === 0 }">
    <li v-for="node in nodes" :key="node.id" class="otree__item">
      <div
        class="otree__row"
        :class="{
          'is-sel': store.selectedId === node.id,
          'is-hint-before': hintFor(node) === 'before',
          'is-hint-after': hintFor(node) === 'after',
          'is-hint-inside': hintFor(node) === 'inside',
        }"
        :data-outline-id="node.id"
        :style="{ paddingLeft: `${6 + depth * 14}px` }"
        draggable="true"
        @click="selectRow(node)"
        @mouseenter="store.hover(node.id)"
        @mouseleave="store.hover(null)"
        @dragstart="onDragStart($event, node)"
        @dragover="onDragOver($event, node)"
        @dragleave="onDragLeave(node)"
        @drop="onDrop($event, node)"
        @dragend="store.clearDrag()"
      >
        <span
          class="otree__arrow"
          :class="{ 'is-leaf': !hasChildren(node) }"
          :title="hasChildren(node) ? '展开 / 收起' : ''"
          @click.stop="toggle(node)"
        >
          {{ hasChildren(node) ? (expanded.has(node.id) ? "▾" : "▸") : "" }}
        </span>
        <span class="otree__icon">{{ materialOf(node)?.icon ?? "?" }}</span>
        <span class="otree__name" :title="labelOf(node)">{{ labelOf(node) }}</span>
        <span v-if="hasChildren(node)" class="otree__count">{{ node.children!.length }}</span>
        <span class="otree__acts">
          <button class="otree__act" title="复制" @click.stop="copyRow(node)">⧉</button>
          <button class="otree__act" title="删除" @click.stop="removeRow(node)">✕</button>
        </span>
      </div>

      <OutlineTree
        v-if="hasChildren(node) && expanded.has(node.id)"
        :nodes="node.children!"
        :depth="depth + 1"
        :expanded="expanded"
      />
    </li>
  </ul>
</template>

<style scoped>
.otree {
  margin: 0;
  padding: 0;
  list-style: none;
}
.otree__item {
  min-width: 0;
}
.otree__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 6px;
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
  border-radius: 5px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease, color 0.12s ease;
}
.otree__row:hover {
  background: var(--wb-bg);
}
.otree__row.is-sel {
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
  font-weight: 600;
}
.otree__row.is-hint-before {
  border-top-color: var(--wb-primary);
}
.otree__row.is-hint-after {
  border-bottom-color: var(--wb-primary);
}
.otree__row.is-hint-inside {
  outline: 1px dashed var(--wb-primary);
  outline-offset: -2px;
  background: var(--wb-primary-soft);
}
.otree__arrow {
  flex: 0 0 12px;
  font-size: 10px;
  color: var(--wb-ink3);
  text-align: center;
  line-height: 1;
}
.otree__arrow.is-leaf {
  visibility: hidden;
}
.otree__icon {
  flex: 0 0 16px;
  text-align: center;
  font-size: 12px;
  opacity: 0.75;
}
.otree__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.otree__count {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--wb-bg);
  font-size: 10px;
  color: var(--wb-ink3);
  line-height: 14px;
}
.otree__acts {
  display: none;
  flex: 0 0 auto;
  gap: 2px;
}
.otree__row:hover .otree__acts,
.otree__row.is-sel .otree__acts {
  display: flex;
}
.otree__act {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 11px;
  cursor: pointer;
  line-height: 1;
}
.otree__act:hover {
  background: #fff;
  color: var(--wb-primary);
}
</style>
