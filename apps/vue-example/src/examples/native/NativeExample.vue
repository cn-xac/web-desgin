<script setup lang="ts">
import { ref } from "vue";
import { SchemaRenderer } from "@x-ac/design-vue";
import { toJSON, validatePage, type NodeSchema, type PageSchema, type UiEventPayload } from "@x-ac/design-core";
import { demoAdapter } from "./materials";

// 一份最小 PageSchema：标题 + 输入（modelValue 表达式绑定到 data.name）+ 按钮。
// 注意绑定不是 bind 字段，而是 props.modelValue 写成 "{{name}}" 表达式。
const page = ref<PageSchema>({
  schemaVersion: "1.0.0",
  id: "demo-page",
  type: "page",
  meta: { title: "原生组件示例", device: "pc" },
  state: {},
  children: [
    { id: "h1", component: "native-heading", props: { text: "原生组件示例", level: 2 } },
    { id: "name", component: "native-input", props: { placeholder: "请输入姓名", modelValue: "{{name}}" } },
    { id: "btn", component: "native-button", props: { label: "提交", type: "primary" }, events: { click: [] } },
  ] as NodeSchema[],
});

const data = ref<Record<string, unknown>>({});
const issues = ref<string[]>([]);
const exported = ref("");

// node-event：只读通知，拿到完整 UiEventPayload（事件名 name、节点 node、物料、scope…）。
// 返回 false 或 preventDefault() 可拦截该事件配置的预设动作；这里只读展示。
function onNodeEvent(payload: UiEventPayload) {
  if (payload.name === "click" && payload.component === "native-button") {
    issues.value = validatePage(page.value).issues.map((i) => i.message);
    window.alert(`提交数据：\n${JSON.stringify(data.value, null, 2)}`);
  }
}

function exportSchema() {
  // core 导出能力：toJSON 序列化 PageSchema（含旧版本自动迁移）。
  exported.value = toJSON(page.value);
}
</script>

<template>
  <section class="nx-card">
    <!-- 组件级 :adapter 覆盖全局注入，演示「宿主按需挂载自己的物料表」 -->
    <SchemaRenderer
      :page="page"
      :adapter="demoAdapter"
      v-model:data="data"
      @node-event="onNodeEvent"
    />

    <div class="nx-row">
      <strong>表单数据（data）：</strong>
      <pre class="nx-pre">{{ JSON.stringify(data, null, 2) }}</pre>
    </div>

    <div class="nx-row">
      <button class="nx-btn nx-btn--default" @click="exportSchema">导出 Schema JSON（core.toJSON）</button>
      <span v-if="issues.length" class="nx-warn">校验问题：{{ issues.join("；") }}</span>
    </div>

    <pre v-if="exported" class="nx-pre">{{ exported }}</pre>
  </section>
</template>
