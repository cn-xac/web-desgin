<script setup lang="ts">
import { ref } from "vue";
import { SchemaRenderer } from "@x-ac/web-design-vue";
import {
  validatePage,
  type NodeSchema,
  type PageSchema,
  type UiEventPayload,
} from "@x-ac/web-design-core";
import { demoAdapter } from "./materials";

/**
 * 演示两个新能力：
 * ① 自动绑定：native-input 不写 modelValue，引擎按「前缀.组件ID」取值（组件ID即数据键）。
 *    —— 见下方 n_name 节点，传入 data.form.n_name 即可自动回填，无需逐组件绑定。
 * ② 子表单（无限级）：节点 component 为 ec-subform，其 children 即「每组模板」，
 *    组内字段按 form.<itemPath>[i].<组件ID> 绑定；嵌套时前缀逐层叠加。
 */
const page = ref<PageSchema>({
  schemaVersion: "1.0.0",
  id: "demo-bind-subform",
  type: "page",
  meta: { title: "自动绑定 + 子表单", device: "pc" },
  state: {},
  children: [
    { id: "h_tip", component: "native-heading", props: { text: "自动绑定 + 子表单（无限级）", level: 2 } },

    // ① 自动绑定：不写 modelValue，按 form.n_name 自动取数
    {
      id: "n_name",
      component: "native-input",
      props: { placeholder: "姓名（按组件ID自动绑定 form.n_name）" },
    },

    // ② 一级子表单：家庭成员（minItems=1 让初始就有一组空模板）
    {
      id: "sub_members",
      component: "ec-subform",
      props: { label: "家庭成员", itemPath: "members", addText: "添加成员", minItems: 1 },
      children: [
        { id: "n_member_name", component: "native-input", props: { placeholder: "成员姓名" } },
        { id: "n_member_age", component: "native-input", props: { placeholder: "成员年龄" } },
      ],
    } as NodeSchema,

    // ③ 嵌套子表单：订单 → 商品（演示无限级）
    {
      id: "sub_orders",
      component: "ec-subform",
      props: { label: "订单", itemPath: "orders", addText: "添加订单", minItems: 1 },
      children: [
        { id: "n_order_no", component: "native-input", props: { placeholder: "订单号" } },
        {
          id: "sub_goods",
          component: "ec-subform",
          props: { label: "商品", itemPath: "goods", addText: "添加商品" },
          children: [
            { id: "n_goods_name", component: "native-input", props: { placeholder: "商品名" } },
          ],
        } as NodeSchema,
      ],
    } as NodeSchema,

    {
      id: "btn_submit",
      component: "native-button",
      props: { label: "提交并查看数据", type: "primary" },
      events: { click: [] },
    },
  ] as NodeSchema[],
});

// 初始数据：n_name 命中自动绑定；子表单数组由 minItems 在挂载时建空组
const data = ref<Record<string, unknown>>({ form: { n_name: "张三" } });
const issues = ref<string[]>([]);

function onNodeEvent(payload: UiEventPayload) {
  if (payload.name === "click" && payload.component === "native-button") {
    issues.value = validatePage(page.value).issues.map((i) => i.message);
    window.alert(`提交数据：\n${JSON.stringify(data.value, null, 2)}`);
  }
}
</script>

<template>
  <section class="nx-card">
    <SchemaRenderer
      :page="page"
      :adapter="demoAdapter"
      v-model:data="data"
      @node-event="onNodeEvent"
    />

    <div class="nx-row">
      <strong>实时表单数据（data）：</strong>
      <pre class="nx-pre">{{ JSON.stringify(data, null, 2) }}</pre>
    </div>

    <div v-if="issues.length" class="nx-warn">校验问题：{{ issues.join("；") }}</div>
  </section>
</template>
