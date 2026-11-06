# @x-ac/design-vue

Vue 3 适配层：Schema 渲染器 + 可视化设计器 + Element Plus 物料 + 表单校验。

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

## 物料与组件映射

24 个物料（布局 / 展示 / 表单 / 交互 / 业务）映射到 Element Plus。替换或新增物料只需改 `src/materials/components.ts` 与 `packages/core` 的物料清单，渲染器与设计器内核不用改。

**约束**：自定义物料必须接收并应用 `style`，否则通用 margin / padding 会失效。

## 主题

```ts
import "@x-ac/design-vue/style.css"; // 渲染器 + 设计器 + 设计令牌
```

## License

MIT
