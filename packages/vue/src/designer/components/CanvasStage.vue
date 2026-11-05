<script setup lang="ts">
import { computed, provide } from "vue";
import { SchemaRenderer } from "../../renderer";
import { DESIGNER_SCENE, type DesignerScene } from "../../renderer/context";
import { useDesignerStore } from "../store";

/** 画布不认识路由：跳转由宿主通过 prop 注入 */
const props = defineProps<{ navigate?: (to: string) => void }>();

const store = useDesignerStore();

provide(DESIGNER_SCENE, {
  selectedId: () => store.selectedId,
  select: (id) => store.select(id),
  onNodeDragStart: (id) => store.beginDrag({ kind: "move", id }),
  onNodeDragOver: (hint) => store.setDropHint(hint),
  onNodeDragLeave: (id) => {
    if (store.dropHint?.id === id) store.setDropHint(null);
  },
  onNodeDrop: (hint) => store.applyDrop(hint),
  hintFor: (id) => (store.dropHint?.id === id ? store.dropHint.position : null),
} satisfies DesignerScene);

const device = computed(() => store.page.meta?.device ?? "pc");
const canvasWidth = computed(() => (device.value === "h5" ? 420 : device.value === "pad" ? 768 : 960));
const deviceLabel = computed(() => (device.value === "h5" ? "H5 · 420" : device.value === "pad" ? "Pad · 768" : "PC · 960"));

function navigate(to: string): void {
  props.navigate?.(to);
}

function onStageDragOver(): void {
  if (store.dropHint) store.setDropHint(null);
}

function onStageDrop(event: DragEvent): void {
  event.preventDefault();
  store.applyDrop({ id: null, position: "inside" });
}
</script>

<template>
  <div class="stage wb-scroll" @click.self="store.select(null)" @dragover.prevent="onStageDragOver" @drop="onStageDrop">
    <div class="stage__inner">
      <div class="canvas" :style="{ maxWidth: `${canvasWidth}px` }" @click.self="store.select(null)">
        <div class="canvas__bar">
          <span class="canvas__title">{{ store.page.meta?.title ?? "未命名页面" }}</span>
          <span class="canvas__badge">{{ deviceLabel }}</span>
        </div>
        <div class="canvas__body" @click.self="store.select(null)">
          <SchemaRenderer :page="store.page" mode="edit" design :navigate="navigate" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  flex: 1;
  min-width: 0;
  padding: 22px;
  background: radial-gradient(circle at 1px 1px, #d9dde6 1px, transparent 0) 0 0 / 16px 16px;
  background-color: var(--wb-bg);
}
.stage__inner {
  display: flex;
  justify-content: center;
  min-height: 100%;
}
.canvas {
  width: 100%;
  min-height: calc(100vh - 96px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(20, 30, 60, 0.08), 0 10px 30px rgba(20, 30, 60, 0.06);
  padding: 16px 20px 32px;
}
.canvas__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 14px;
  border-bottom: 1px dashed var(--wb-line);
}
.canvas__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink2);
}
.canvas__badge {
  font-size: 11px;
  color: var(--wb-ink3);
  background: var(--wb-bg);
  border-radius: 4px;
  padding: 1px 6px;
}
.canvas__body {
  min-height: 200px;
}
</style>
