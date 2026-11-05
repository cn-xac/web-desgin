<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useDesignerStore } from "./store";
import PalettePanel from "./components/PalettePanel.vue";
import CanvasStage from "./components/CanvasStage.vue";
import InspectorPanel from "./components/InspectorPanel.vue";
import { migratePage } from "@x-ac/design-core";
import { validatePage } from "@x-ac/design-core";
import { KNOWN_COMPONENTS } from "@x-ac/design-core";
import { toHtml } from "@x-ac/design-core";
import type { DeviceType } from "@x-ac/design-core";

/**
 * 设计器不依赖路由：页面 id 由宿主传入，跳转通过事件抛给宿主。
 * 这样既能挂在本项目的路由上，也能嵌进任何已有 Vue 后台的某个 Tab 里。
 */
const props = defineProps<{
  pageId: string;
  /** 可选：宿主提供预览地址构造函数，设计器直接打开新窗口 */
  previewUrl?: (id: string) => string;
  /** 可选：动作里的「页面跳转」交给宿主处理 */
  navigate?: (to: string) => void;
}>();

const emit = defineEmits<{
  back: [];
  preview: [id: string];
  saved: [id: string];
}>();

const store = useDesignerStore();
const ready = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const pageId = computed(() => props.pageId);
const title = computed({
  get: () => String(store.page.meta?.title ?? ""),
  set: (value: string) => store.setTitle(value),
});
const device = computed({
  get: () => (store.page.meta?.device ?? "pc") as DeviceType,
  set: (value: DeviceType) => store.setDevice(value),
});

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeunload", onBeforeUnload);
});

watch(
  () => props.pageId,
  (id) => {
    if (!id) return;
    const loaded = store.load(id);
    if (!loaded) {
      ElMessage.error("页面不存在或已被删除");
      emit("back");
      return;
    }
    ready.value = true;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("beforeunload", onBeforeUnload);
});

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!store.dirty) return;
  event.preventDefault();
  event.returnValue = "";
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
}

function onKeydown(event: KeyboardEvent): void {
  if (isTyping(event.target)) return;
  const withMeta = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (withMeta && key === "z") {
    event.preventDefault();
    if (event.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (withMeta && key === "y") {
    event.preventDefault();
    store.redo();
    return;
  }
  if (withMeta && key === "s") {
    event.preventDefault();
    save();
    return;
  }
  if (withMeta && key === "d") {
    event.preventDefault();
    store.duplicateSelected();
    return;
  }
  if (withMeta && key === "c") {
    store.copySelected();
    return;
  }
  if (withMeta && key === "v") {
    event.preventDefault();
    store.pasteNode();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    if (!store.selectedNode) return;
    event.preventDefault();
    store.removeSelected();
    return;
  }
  if (event.key === "Escape") store.select(null);
}

function save(): boolean {
  try {
    store.save();
    ElMessage.success("已保存");
    emit("saved", pageId.value);
    return true;
  } catch (error) {
    ElMessage.error(`保存失败：${(error as Error).message}`);
    return false;
  }
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportJSON(): void {
  const json = store.exportJSON();
  download(`${store.page.meta?.title ?? "page"}.json`, json, "application/json");
  void navigator.clipboard?.writeText(json);
  ElMessage.success("已导出 JSON 并复制到剪贴板");
}

/** 导出静态 HTML：同一份 Schema 在浏览器外也能渲染，证明 core 与框架解耦 */
function exportHtml(): void {
  const html = toHtml(store.page);
  download(`${store.page.meta?.title ?? "page"}.html`, html, "text/html");
  ElMessage.success("已导出静态 HTML");
}

function triggerImport(): void {
  fileInput.value?.click();
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { schema, applied } = migratePage(reader.result);
      const result = validatePage(schema, KNOWN_COMPONENTS);
      if (!result.valid) {
        throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("；"));
      }
      store.replaceWith(schema);
      ElMessage.success(applied.length ? `已导入（执行迁移 ${applied.join(", ")}）` : "已导入，记得保存");
    } catch (error) {
      ElMessage.error(`导入失败：${(error as Error).message}`);
    }
    input.value = "";
  };
  reader.readAsText(file);
}

function preview(): void {
  if (!save()) return;
  emit("preview", pageId.value);
  if (props.previewUrl) window.open(props.previewUrl(pageId.value), "_blank");
}

function backToList(): void {
  if (store.dirty) {
    ElMessage.warning("当前有未保存的修改，已自动保存");
    try {
      store.save();
    } catch {
      /* 校验失败时仍然允许离开，避免卡住 */
    }
  }
  emit("back");
}
</script>

<template>
  <div v-if="ready" class="designer">
    <header class="topbar">
      <button class="icon-btn" title="返回页面列表" @click="backToList">←</button>
      <input v-model="title" class="title-input" placeholder="页面标题" />
      <span v-if="store.dirty" class="dirty" title="有未保存的修改">●</span>

      <el-radio-group v-model="device" size="small" class="device">
        <el-radio-button value="pc">PC</el-radio-button>
        <el-radio-button value="pad">Pad</el-radio-button>
        <el-radio-button value="h5">H5</el-radio-button>
      </el-radio-group>

      <div class="divider" />

      <button class="icon-btn" title="撤销 (Ctrl+Z)" :disabled="!store.canUndo" @click="store.undo()">↶</button>
      <button class="icon-btn" title="重做 (Ctrl+Shift+Z)" :disabled="!store.canRedo" @click="store.redo()">↷</button>

      <span class="stat">{{ store.nodeCount }} 个节点</span>

      <div class="spacer" />

      <el-button size="small" @click="triggerImport">导入</el-button>
      <el-button size="small" @click="exportJSON">导出 JSON</el-button>
      <el-button size="small" @click="exportHtml">导出 HTML</el-button>
      <el-button size="small" @click="preview">预览</el-button>
      <el-button size="small" type="primary" @click="save">保存</el-button>
    </header>

    <div class="body">
      <PalettePanel />
      <CanvasStage :navigate="navigate" />
      <InspectorPanel />
    </div>

    <input ref="fileInput" type="file" accept=".json,application/json" class="hidden-input" @change="onFileChange" />
  </div>
</template>

<style scoped>
.designer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid var(--wb-line);
  flex: 0 0 auto;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--wb-ink2);
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}
.icon-btn:hover:not(:disabled) {
  background: var(--wb-bg);
  border-color: var(--wb-line);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.title-input {
  width: 220px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wb-ink);
}
.title-input:hover {
  border-color: var(--wb-line);
}
.title-input:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
.dirty {
  font-size: 8px;
  color: var(--el-color-warning);
  margin-left: -4px;
}
.device {
  margin-left: 8px;
}
.divider {
  width: 1px;
  height: 18px;
  background: var(--wb-line);
  margin: 0 4px;
}
.stat {
  font-size: 11.5px;
  color: var(--wb-ink3);
  margin-left: 4px;
}
.spacer {
  flex: 1;
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.hidden-input {
  display: none;
}
</style>
