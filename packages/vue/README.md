# @x-ac/design-vue

Vue 3 适配层：Schema 渲染器 + 可视化设计器 + 给 `vue-*` 扩展仓用的组件作者 SDK（`@x-ac/design-vue/kit`）。
具体 UI 库的物料实现放在独立扩展仓（如 `design-vue-element-plus`），本包不内置任何 UI 库物料。

与 `@x-ac/design-core` 共享同一份 Schema 与校验引擎，换到 React（`@x-ac/design-react`）时页面 JSON 不用改。

## 安装

```bash
pnpm add @x-ac/design-vue @x-ac/design-core vue element-plus
# 设计器需要 pinia
pnpm add pinia
```

## 只渲染页面（标签即用）

`SchemaPage` 与 `SchemaRenderer` 是同一组件的两个名字。最简形态——一个标签 + 两个事件：

```vue
<script setup lang="ts">
import { ref } from "vue";
import { SchemaPage } from "@x-ac/design-vue";
import "@x-ac/design-vue/style.css";
import type { PageSchema } from "@x-ac/design-vue";

// page 可以是 Schema 对象，也可以直接是后端返回的 JSON 字符串
const page = ref<PageSchema>(/* 来自后端或本地 JSON */);
const formData = ref<Record<string, unknown>>({});

// v-model:data：页面里填的数据实时同步出来
// @submit：submitForm 动作提交成功时抛出组装好的数据行（发后端在这里做）
function onSubmit(payload: Record<string, unknown>) {
  void fetch("/api/rows", { method: "POST", body: JSON.stringify(payload) });
}
</script>

<template>
  <SchemaPage :page="page" v-model:data="formData" @submit="onSubmit">
    <template #empty>页面还没有内容</template>
  </SchemaPage>
</template>
```

渲染器通过 `defineExpose` 暴露：

| 方法 | 说明 |
|---|---|
| `validate()` | 校验整页，返回 `boolean`，错误同时写入 `errors` |
| `getData(options?)` | 返回 `{ data, flat, fields, errors, valid }` |
| `getErrors()` | 当前 `nodeId -> 文案` |
| `reset()` | 恢复 `page.state` 初值并清空错误 |
| `scope` | 当前页面状态（响应式对象） |

字段失焦会自动单字段校验；修改输入时，已报错的字段会边改边验，改对即消红。

## 内嵌设计器（标签即用）

```vue
<script setup lang="ts">
import { SchemaDesigner, type PageRepository } from "@x-ac/design-vue/designer";
// 设计器样式与渲染器同在一个 style.css 里（cssCodeSplit: false）

// repository prop：组件级仓储，不传回落全局 setPageRepository()
const repo: PageRepository = { /* list / get / save / remove，对接你的接口 */ };
</script>

<template>
  <SchemaDesigner
    :page-id="pageId"
    :repository="repo"
    @back="router.push('/pages')"
    @preview="(id) => window.open(`/preview/${id}`)"
    @export-schema="({ kind, content }) => archive(kind, content)"
  />
</template>
```

设计器**不内置路由**：只接收 `pageId`，跳转通过事件交给宿主。模板 ref 暴露 `importSchema(json)` / `exportSchema()` / `exportHtml()` / `save()`，宿主可在自己的按钮里主动触发导入导出；工具栏导出时同步触发 `@export-schema` 事件。

右侧「校验」面板可以配置必填、最短 / 最长长度、最小 / 最大值、自定义正则、邮箱、手机号、整数，并支持自定义文案与 `when` 条件。

## 给 vue-* 扩展仓用的适配层 SDK

`vue-*` 扩展仓（Element Plus、图标库、ant-design-vue 等）都基于本包的 `/kit` 子入口实现，而不是自己拼 `UiAdapter` 字面量：

```ts
import { defineVueAdapter, createDesignerKit, useFieldModel, VUE_BINDING } from "@x-ac/design-vue/kit";

export const myAdapter = defineVueAdapter({
  name: "my-ui",
  components: prefixedComponents(COMPONENT_TABLE), // 归一化工具来自 core
  materials: myMaterials,
  designer: createDesignerKit({ Button: MyButton /* ... */ }),
  actions: myActions,
  binding: VUE_BINDING,
});
```

`/kit` 是纯 TS 子入口：不加载渲染器、设计器、CSS 与 pinia，产物约 0.74 kB，扩展仓组件可在 jsdom / SSR 独立挂载。框架无关的契约（`UiAdapter` / `DesignerControlProps`）与工具（`parsePairs` / `prefixedComponents` / `defineAdapter` / `bindModel`）统一在 `@x-ac/design-core`。

**约束**：自定义物料必须接收并应用 `style`，否则通用 margin / padding 会失效。

## 主题

```ts
import "@x-ac/design-vue/style.css"; // 渲染器 + 设计器 + 设计令牌
```

## License

MIT
