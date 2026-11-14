<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { effectiveRules } from "@x-ac/web-design-core";
import { useMaterialCatalog } from "../../materials/catalog";
import { useDesignerStore } from "../store";
import UiControl from "../ui/UiControl.vue";
import PropsEditor from "./PropsEditor.vue";
import StyleEditor from "./StyleEditor.vue";
import EventsEditor from "./EventsEditor.vue";
import SchemaViewer from "./SchemaViewer.vue";
import RulesEditor from "./RulesEditor.vue";
import PageSettings from "./PageSettings.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();

/** 选中节点时的面板：Schema 是整页视图，归到页面设置，不放这里 */
type NodeTabKey = "props" | "style" | "rules" | "events";
const NODE_TABS: Array<{ key: NodeTabKey; label: string }> = [
  { key: "props", label: "属性" },
  { key: "style", label: "样式" },
  { key: "rules", label: "校验" },
  { key: "events", label: "事件" },
];

/** 未选中节点时的面板：页面设置 + 整页 Schema */
type PageTabKey = "settings" | "schema";
const PAGE_TABS: Array<{ key: PageTabKey; label: string }> = [
  { key: "settings", label: "页面设置" },
  { key: "schema", label: "Schema" },
];

const nodeTab = ref<NodeTabKey>("props");
const pageTab = ref<PageTabKey>("settings");
const hasSelection = computed(() => Boolean(store.selectedNode));

const selectedMaterial = computed(() => catalog.get(store.selectedNode?.component ?? ""));
/** 只有表单控件才有校验面板 */
const isField = computed(() => Boolean(selectedMaterial.value?.isFormControl));

const visibleTabs = computed(() => NODE_TABS.filter((item) => item.key !== "rules" || isField.value));

const ruleCount = computed(() => {
  const node = store.selectedNode;
  if (!node) return 0;
  return effectiveRules(node, catalog.defaults(node.component, node.props)).length;
});

watch(hasSelection, (selected) => {
  if (selected) nodeTab.value = "props";
});

watch(isField, (field) => {
  if (!field && nodeTab.value === "rules") nodeTab.value = "props";
});

const breadcrumbText = computed(() =>
  store.breadcrumb
    .map((node) => catalog.get(node.component)?.title ?? node.component)
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
          :class="{ 'is-active': nodeTab === item.key }"
          @click="nodeTab = item.key"
        >
          {{ item.label }}
          <span v-if="item.key === 'rules' && ruleCount" class="inspector__count">{{ ruleCount }}</span>
          <span v-else-if="item.key === 'events' && tabEvents.length" class="inspector__count">{{ tabEvents.length }}</span>
        </button>
      </div>

      <div class="inspector__body wb-scroll">
        <PropsEditor v-if="nodeTab === 'props'" />
        <StyleEditor v-else-if="nodeTab === 'style'" />
        <RulesEditor v-else-if="nodeTab === 'rules'" />
        <EventsEditor v-else />
      </div>

      <div class="inspector__footer">
        <UiControl as="Button" size="small" @click="store.moveSelected(-1)">上移</UiControl>
        <UiControl as="Button" size="small" @click="store.moveSelected(1)">下移</UiControl>
        <UiControl as="Button" size="small" @click="store.duplicateSelected()">复制</UiControl>
        <UiControl as="Button" size="small" type="danger" plain @click="store.removeSelected()">删除</UiControl>
      </div>
    </template>

    <template v-else>
      <div class="inspector__tabs">
        <button
          v-for="item in PAGE_TABS"
          :key="item.key"
          class="inspector__tab"
          :class="{ 'is-active': pageTab === item.key }"
          @click="pageTab = item.key"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="inspector__body wb-scroll">
        <PageSettings v-if="pageTab === 'settings'" />
        <SchemaViewer v-else />
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
.inspector__footer--tip {
  justify-content: center;
  font-size: 11.5px;
  color: var(--wb-ink3);
}
</style>
