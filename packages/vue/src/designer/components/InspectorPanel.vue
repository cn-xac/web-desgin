<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { effectiveRules, getMaterial, resolveDefaults } from "@x-ac/design-core";
import { useDesignerStore } from "../store";
import PropsEditor from "./PropsEditor.vue";
import StyleEditor from "./StyleEditor.vue";
import EventsEditor from "./EventsEditor.vue";
import SchemaViewer from "./SchemaViewer.vue";
import RulesEditor from "./RulesEditor.vue";
import PageSettings from "./PageSettings.vue";

const store = useDesignerStore();

type TabKey = "props" | "style" | "rules" | "events" | "schema";
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "props", label: "属性" },
  { key: "style", label: "样式" },
  { key: "rules", label: "校验" },
  { key: "events", label: "事件" },
  { key: "schema", label: "Schema" },
];

const tab = ref<TabKey>("props");
const hasSelection = computed(() => Boolean(store.selectedNode));

const selectedMaterial = computed(() => getMaterial(store.selectedNode?.component ?? ""));
/** 只有表单控件才有校验面板 */
const isField = computed(() => Boolean(selectedMaterial.value?.isFormControl));

const visibleTabs = computed(() => TABS.filter((item) => item.key !== "rules" || isField.value));

const ruleCount = computed(() => {
  const node = store.selectedNode;
  if (!node) return 0;
  return effectiveRules(node, resolveDefaults(node.component, node.props)).length;
});

watch(hasSelection, (selected) => {
  if (selected) tab.value = "props";
  else if (tab.value === "schema") tab.value = "props";
});

watch(isField, (field) => {
  if (!field && tab.value === "rules") tab.value = "props";
});

const breadcrumbText = computed(() =>
  store.breadcrumb
    .map((node) => getMaterial(node.component)?.title ?? node.component)
    .join(" / "),
);

const tabEvents = computed(() => selectedMaterial.value?.events ?? []);
</script>

<template>
  <aside class="inspector">
    <template v-if="hasSelection">
      <div class="inspector__crumbs" :title="breadcrumbText">
        {{ breadcrumbText }}
      </div>
      <div class="inspector__tabs">
        <button
          v-for="item in visibleTabs"
          :key="item.key"
          class="inspector__tab"
          :class="{ 'is-active': tab === item.key }"
          @click="tab = item.key"
        >
          {{ item.label }}
          <span v-if="item.key === 'rules' && ruleCount" class="inspector__count">{{ ruleCount }}</span>
          <span v-else-if="item.key === 'events' && tabEvents.length" class="inspector__count">{{ tabEvents.length }}</span>
        </button>
      </div>

      <div class="inspector__body wb-scroll">
        <PropsEditor v-if="tab === 'props'" />
        <StyleEditor v-else-if="tab === 'style'" />
        <RulesEditor v-else-if="tab === 'rules'" />
        <EventsEditor v-else-if="tab === 'events'" />
        <SchemaViewer v-else />
      </div>

      <div class="inspector__footer">
        <el-button size="small" @click="store.moveSelected(-1)">上移</el-button>
        <el-button size="small" @click="store.moveSelected(1)">下移</el-button>
        <el-button size="small" @click="store.duplicateSelected()">复制</el-button>
        <el-button size="small" type="danger" plain @click="store.removeSelected()">删除</el-button>
      </div>
    </template>

    <template v-else>
      <div class="inspector__tabs inspector__tabs--single">
        <button class="inspector__tab is-active">页面设置</button>
      </div>
      <div class="inspector__body wb-scroll">
        <PageSettings />
      </div>
      <div class="inspector__footer inspector__footer--tip">点击画布中的任意元素以编辑其属性</div>
    </template>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  width: 344px;
  background: #fff;
  border-left: 1px solid var(--wb-line);
}
.inspector__crumbs {
  padding: 8px 12px;
  border-bottom: 1px solid var(--wb-line-soft);
  font-size: 11.5px;
  color: var(--wb-ink3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inspector__tabs {
  display: flex;
  border-bottom: 1px solid var(--wb-line);
  flex: 0 0 auto;
}
.inspector__tab {
  flex: 1;
  padding: 9px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--wb-ink3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.inspector__tab:hover {
  color: var(--wb-ink);
}
.inspector__tab.is-active {
  color: var(--wb-primary);
  border-bottom-color: var(--wb-primary);
  font-weight: 600;
}
.inspector__count {
  font-size: 10px;
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
  border-radius: 6px;
  padding: 0 4px;
  line-height: 14px;
}
.inspector__body {
  flex: 1;
  min-height: 0;
}
.inspector__footer {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--wb-line);
}
.inspector__footer :deep(.el-button) {
  flex: 1;
  margin-left: 0;
}
.inspector__footer--tip {
  justify-content: center;
  font-size: 11.5px;
  color: var(--wb-ink3);
}
</style>
