<script setup lang="ts">
import { computed } from "vue";
import UiControl from "../ui/UiControl.vue";
import { toJSON } from "@x-ac/design-core";
import { useDesignerStore } from "../store";
import { useNotify } from "../ui/kit";

const notify = useNotify();

const store = useDesignerStore();
const json = computed(() => toJSON(store.page));

function copy(): void {
  void navigator.clipboard?.writeText(json.value);
  notify("Schema 已复制", "success");
}

function download(): void {
  const blob = new Blob([json.value], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${store.page.meta?.title ?? "page"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
</script>

<template>
  <div class="schema">
    <div class="schema__bar">
      <span class="schema__title">PageSchema · {{ json.length }} 字符</span>
      <div class="spacer" />
      <UiControl as="Button" size="small" text type="primary" @click="copy">复制</UiControl>
      <UiControl as="Button" size="small" text type="primary" @click="download">下载</UiControl>
    </div>
    <pre class="schema__code">{{ json }}</pre>
  </div>
</template>

<style scoped>
.schema {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.schema__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--wb-line-soft);
}
.schema__title {
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.spacer {
  flex: 1;
}
.schema__code {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: var(--wb-mono);
  font-size: 11px;
  line-height: 1.6;
  color: #334;
  background: #fafbfd;
  white-space: pre;
}
</style>
