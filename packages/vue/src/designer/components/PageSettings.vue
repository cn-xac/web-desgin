<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import type { DeviceType } from "@x-ac/design-core";
import { useDesignerStore } from "../store";

const store = useDesignerStore();

const stateText = ref(JSON.stringify(store.page.state ?? {}, null, 2));
const dataSourceText = ref(JSON.stringify(store.page.dataSource ?? {}, null, 2));
const stateError = ref("");
const dataSourceError = ref("");

const device = computed({
  get: () => (store.page.meta?.device ?? "pc") as DeviceType,
  set: (value: DeviceType) => store.setDevice(value),
});

const dataSourceEntries = computed(() => Object.entries(store.page.dataSource ?? {}));

function applyState(): void {
  try {
    const parsed = JSON.parse(stateText.value || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("state 必须是对象");
    }
    store.patchPage({ state: parsed as Record<string, unknown> });
    stateError.value = "";
    ElMessage.success("页面状态已更新");
  } catch (error) {
    stateError.value = (error as Error).message;
  }
}

function applyDataSource(): void {
  try {
    const parsed = JSON.parse(dataSourceText.value || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("dataSource 必须是对象");
    }
    store.patchPage({ dataSource: parsed as Record<string, never> });
    dataSourceError.value = "";
    ElMessage.success("数据源已更新");
  } catch (error) {
    dataSourceError.value = (error as Error).message;
  }
}
</script>

<template>
  <div class="settings">
    <div class="settings__section">页面</div>
    <div class="settings__row">
      <label>标题</label>
      <el-input
        size="small"
        :model-value="String(store.page.meta?.title ?? '')"
        @update:model-value="(v: string) => store.setTitle(v)"
      />
    </div>
    <div class="settings__row">
      <label>设备</label>
      <el-select v-model="device" size="small">
        <el-option label="PC · 960" value="pc" />
        <el-option label="Pad · 768" value="pad" />
        <el-option label="H5 · 420" value="h5" />
      </el-select>
    </div>
    <div class="settings__row">
      <label>页面 ID</label>
      <span class="settings__mono">{{ store.page.id }}</span>
    </div>

    <div class="settings__section">
      页面状态 state
      <span class="settings__hint">渲染时注入 scope，供双花括号表达式取值</span>
    </div>
    <el-input
      v-model="stateText"
      type="textarea"
      :rows="8"
      size="small"
      class="settings__code"
      spellcheck="false"
    />
    <div v-if="stateError" class="settings__error">{{ stateError }}</div>
    <el-button size="small" type="primary" plain @click="applyState">应用状态</el-button>

    <div class="settings__section">
      数据源 dataSource
      <span class="settings__hint">{{ dataSourceEntries.length }} 项</span>
    </div>
    <el-input
      v-model="dataSourceText"
      type="textarea"
      :rows="6"
      size="small"
      class="settings__code"
      spellcheck="false"
    />
    <div v-if="dataSourceError" class="settings__error">{{ dataSourceError }}</div>
    <el-button size="small" type="primary" plain @click="applyDataSource">应用数据源</el-button>

    <div class="settings__tip">
      支持 <code>{"type":"static","data":{...}}</code> 与
      <code>{"type":"http","url":"/api/list","auto":true}</code> 两种声明式取数。
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 14px;
}
.settings__section {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 18px 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wb-ink3);
}
.settings__section:first-child {
  margin-top: 0;
}
.settings__hint {
  font-size: 10.5px;
  font-weight: 400;
  letter-spacing: 0;
  color: #b6bdcb;
}
.settings__row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.settings__row label {
  font-size: 12px;
  color: var(--wb-ink2);
}
.settings__mono {
  font-family: var(--wb-mono);
  font-size: 11px;
  color: var(--wb-ink3);
  overflow: hidden;
  text-overflow: ellipsis;
}
.settings__code :deep(textarea) {
  font-family: var(--wb-mono);
  font-size: 11.5px;
  line-height: 1.55;
}
.settings__error {
  margin: 4px 0 6px;
  font-size: 11.5px;
  color: var(--el-color-danger);
}
.settings__tip {
  margin-top: 14px;
  font-size: 11px;
  color: var(--wb-ink3);
  line-height: 1.7;
}
.settings__tip code {
  font-family: var(--wb-mono);
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 3px;
  padding: 0 3px;
}
</style>
