<script setup lang="ts">
import { computed, ref } from "vue";
import { materialsByCategory } from "@x-ac/design-core";
import { useDesignerStore } from "../store";

const store = useDesignerStore();
const keyword = ref("");

const groups = computed(() => {
  const all = materialsByCategory();
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

function onDragStart(event: DragEvent, component: string): void {
  store.beginDrag({ kind: "new", component });
  if (!event.dataTransfer) return;
  event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "new", component }));
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <aside class="palette">
    <div class="palette__search">
      <el-input v-model="keyword" size="small" placeholder="搜索组件" clearable />
    </div>

    <div class="palette__scroll wb-scroll">
      <section v-for="group in groups" :key="group.category" class="palette__group">
        <div class="palette__title">{{ group.category }}</div>
        <div
          v-for="item in group.items"
          :key="item.component"
          class="palette__item"
          draggable="true"
          :title="item.hint ?? item.title"
          @dragstart="onDragStart($event, item.component)"
          @dragend="store.clearDrag()"
          @click="store.addNodeSmart(item.component)"
        >
          <span class="palette__icon">{{ item.icon }}</span>
          <span class="palette__name">{{ item.title }}</span>
        </div>
      </section>

      <div v-if="!groups.length" class="palette__empty">没有匹配的组件</div>
    </div>

    <div class="palette__foot">拖入画布，或点击添加到选中容器</div>
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
.palette__icon {
  width: 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}
.palette__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
