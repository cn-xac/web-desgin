# @x-ac/web-design

一份 `PageSchema`（JSON），在 **Vue 3** 与 **React 18/19** 里渲染出同一个页面；同一份 Schema 还能喂给内置可视化设计器。校验规则、表达式、数据导出、动作、双向绑定在两端行为完全一致——换框架不改页面 JSON。

> **面向 AI 助手**：仓库根的 [`AGENTS.md`](./AGENTS.md) 是本项目的 AI 使用契约（架构、精确 API 签名、Schema 协议、适配包契约、构建/测试命令），供 Codex / Claude Code / Cursor / WorkBuddy 等 AI 软件自动加载。请优先读取 `AGENTS.md`；其顶部「AI 先读这些文件」列出了应精读的源码与文档路径。

- 框架无关内核 `@x-ac/web-design-core`（零依赖，不碰 `window`/`document`）
- Vue 适配层 `@x-ac/web-design-vue`：渲染器 + 设计器 + 扩展仓 SDK（`/kit`）
- React 适配层 `@x-ac/web-design-react`：渲染器 + 扩展仓 SDK（`/kit`），内置原生元素适配包

> 真实 UI 库物料（Element Plus / antd 等）放在独立**扩展仓**（如 `web-design-vue-element-plus`），通过对应适配层的 `/kit` 子入口实现，本仓不内置任何 UI 库。

## 安装

```bash
# 最小集成（零 UI 库，渲染原生 input/select/button 等）
pnpm add @x-ac/web-design-vue @x-ac/web-design-core vue
# 或 React
pnpm add @x-ac/web-design-react @x-ac/web-design-core react react-dom
```

三包采用 **fixed 单版本组**：永远同一版本号（当前 `1.0.0`）。

## 30 秒上手：Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import { SchemaPage } from "@x-ac/web-design-vue";
import "@x-ac/web-design-vue/style.css";
import type { PageSchema } from "@x-ac/web-design-vue";

// page 可以是对象，也可以是后端返回的 JSON 字符串（自动迁移旧版本）
const page = ref<PageSchema>({
  schemaVersion: "1.0.0",
  id: "demo",
  type: "page",
  meta: { title: "Demo", device: "pc" },
  state: { form: { name: "" } },
  children: [
    { id: "n_name", component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }] },
    { id: "n_submit", component: "button",
      props: { text: "提交" },
      events: { click: [{ action: "submitForm", args: { from: "form" } }] } },
  ],
});
const formData = ref<Record<string, unknown>>({});
</script>

<template>
  <SchemaPage :page="page" v-model:data="formData" />
</template>
```

`SchemaPage` 与 `SchemaRenderer` 是同一组件的两个名字。`v-model:data` 实时同步页面数据；`@submit` 在 `submitForm` 动作成功时抛出组装好的数据行。

## 30 秒上手：React

```tsx
import { useRef } from "react";
import { SchemaRenderer, nativeAdapter, registerMaterials } from "@x-ac/web-design-react";
import type { SchemaRendererHandle, PageSchema } from "@x-ac/web-design-react";
import "@x-ac/web-design-react/style.css";

const page: PageSchema = { /* 同上 */ };

// 在原生适配包之上注册业务物料（不改内核、不污染全局）
const adapter = registerMaterials(nativeAdapter, [
  { component: "biz-rate", title: "满意度", kind: "field", impl: Rate,
    props: { modelValue: 0, max: 5 },
    fields: [{ key: "max", label: "最高分", type: "number" }] },
]);

export function Form() {
  const ref = useRef<SchemaRendererHandle>(null);
  return <SchemaRenderer ref={ref} page={page} ui={adapter} />;
}
```

## 数据绑定 / 校验 / 导出

- 绑定不是节点的 `bind` 字段，而是把 `props.modelValue` 写成表达式 `"{{scopeVar}}"`，引擎按绑定路径自动双向同步。
- 宿主通过 `v-model:data`（Vue）/ `data` + `onDataChange`（React）拿外部数据，带防回环。
- 规则挂在 `node.rules`（纯数据，JSON 里无代码）：`required` / `minLength` / `maxLength` / `min` / `max` / `pattern` / `email` / `phone` / `integer`，支持 `message` 与 `when` 条件。
- 通过 ref 调用 `validate()` / `getData()` / `getErrors()` / `reset()`。

## 可视化设计器

```ts
// Vue
import { SchemaDesigner } from "@x-ac/web-design-vue/designer";
// React
import { SchemaDesigner } from "@x-ac/web-design-react/designer";
import { createMemoryRepository } from "@x-ac/web-design-core";
const repo = createMemoryRepository([page]);
```

四栏（物料面板 / 组件树 / 画布 / 检查器）+ 顶栏（撤销重做、导入导出 JSON·HTML、预览、保存）。设计器不内置路由，跳转通过事件交给宿主。

## 文档

| 文档 | 读者 | 内容 |
|---|---|---|
| `packages/core/README.md` | 开发者 | 内核能力、Schema 速览、校验规则、数据导出 |
| `packages/vue/README.md` | 开发者 | Vue 渲染器 / 设计器 / `/kit` SDK 全用法 |
| `packages/react/README.md` | 开发者 | React 渲染器 / 设计器 / `/kit` SDK 全用法 |
| `docs/EXAMPLES.md` | 开发者 | 三包协作、原生组件最小集成骨架 |
| `docs/VALIDATION.md` | 开发者 | 结构校验 vs 数据校验、规则细节、扩展新规则 |
| `docs/PUBLISH.md` | 维护者 | 单版本组、发布脚本、CI/OIDC 发布 |
| `AGENTS.md` | **AI 智能体** | 完整契约与 API 面，可直接据此使用该开发包 |

## License

MIT
