# 三包用法示例

本项目由三个 npm 包组成，配合扩展仓（如 `design-vue-element-plus`）使用：

| 包 | 角色 | 关键导出 |
|---|---|---|
| `@x-ac/design-core` | 框架无关内核 | `PageSchema` / `NodeSchema` 类型、`registerMaterials`、`defineAdapter` / `defineVueAdapter` / `defineReactAdapter`、`validatePage`、`toJSON` / `toHtml`、`UiEventPayload`、`loadPageData` |
| `@x-ac/design-vue` | Vue 适配层 | `SchemaRenderer` / `createVueDesign`、`nativeAdapter`（经 `/kit`）、`/designer` 子入口、`/style.css` |
| `@x-ac/design-react` | React 适配层 | `SchemaRenderer`、`nativeAdapter`、`/kit` 子入口、`/style.css` |

固定**单版本组**：三包永远同一版本号（当前 `1.0.0`）。

可独立运行的示例见 `apps/vue-example`（Vue）与 `apps/react-example`（React），二者都只依赖对应适配层 + core，**零 UI 库依赖**。

## 三个包如何协作

一份 `PageSchema` 是渲染与设计的共同契约：

- **core** 定义 Schema 结构与协议（校验、表达式、导出、事件），并提供 `registerMaterials` / `defineAdapter` 等框架无关工具；
- **vue / react 适配层** 把 Schema 渲染成真实 UI，并提供 `nativeAdapter`（零 UI 库依赖的原生组件）与 `/kit`（扩展仓作者 SDK）；
- 宿主（你的应用）通过 `UiAdapter` 注入「组件实现 + 绑定通道 + 动作副作用」，再用 `SchemaRenderer` 渲染。

## 最小集成：注册原生组件

扩展点只有一处：**组件实现 + 元数据**。引擎、适配层、设计器都不用改。下面是可直接搬用的骨架（与示例工程一致）。

### Vue（`apps/vue-example`）

```ts
// examples/native/materials.ts
import { MATERIALS, registerMaterials } from "@x-ac/design-core";
import { defineVueAdapter, VUE_BINDING } from "@x-ac/design-vue/kit";
import NativeButton from "./NativeButton.vue";

// 1) 收敛「组件表 + 绑定通道」（VUE_BINDING = modelValue / update:modelValue）
const nativeAdapter = defineVueAdapter({
  name: "vue-native",
  binding: VUE_BINDING,
  materials: MATERIALS,
  components: { "native-button": NativeButton },
});

// 2) 在适配包之上注册物料（含设计器属性面板元数据）
export const demoAdapter = registerMaterials(nativeAdapter, [
  {
    component: "native-button",
    title: "按钮",
    category: "交互",
    kind: "action",
    impl: NativeButton,
    props: { label: "提交", type: "primary" },
    fields: [{ key: "label", label: "文案", type: "text" }],
    events: [{ name: "click", title: "点击" }],
  },
]);
```

```vue
<!-- examples/native/NativeExample.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { SchemaRenderer } from "@x-ac/design-vue";
import { toJSON } from "@x-ac/design-core";
import { demoAdapter } from "./materials";

const page = {
  schemaVersion: "1.0.0",
  id: "demo",
  type: "page",
  children: [
    { id: "name", component: "native-input", props: { placeholder: "姓名", modelValue: "{{name}}" } },
    { id: "btn", component: "native-button", props: { label: "提交" }, events: { click: [] } },
  ],
};
const data = ref({});
function onNodeEvent(payload: { name: string }) {
  if (payload.name === "click") console.log(data.value);
}
</script>

<template>
  <SchemaRenderer :page="page" :adapter="demoAdapter" v-model:data="data" @node-event="onNodeEvent" />
</template>
```

### React（`apps/react-example`）

```tsx
// examples/native/materials.tsx
import { registerMaterials } from "@x-ac/design-core";
import { nativeAdapter } from "@x-ac/design-react";
import { NativeButton } from "./NativeButton";

export const demoAdapter = registerMaterials(nativeAdapter, [
  {
    component: "native-button",
    title: "按钮",
    category: "交互",
    kind: "action",
    impl: NativeButton,
    props: { label: "提交", type: "primary" },
    fields: [{ key: "label", label: "文案", type: "text" }],
    events: [{ name: "click", title: "点击" }],
  },
]);
```

```tsx
// examples/native/NativeExample.tsx
import { useState } from "react";
import { SchemaRenderer } from "@x-ac/design-react";
import { toJSON } from "@x-ac/design-core";
import { demoAdapter } from "./materials";

const page = {
  schemaVersion: "1.0.0",
  id: "demo",
  type: "page",
  children: [
    { id: "name", component: "native-input", props: { placeholder: "姓名", modelValue: "{{name}}" } },
    { id: "btn", component: "native-button", props: { label: "提交" }, events: { click: [] } },
  ],
};

export function NativeExample() {
  const [data, setData] = useState({});
  return (
    <SchemaRenderer
      page={page}
      ui={demoAdapter}
      data={data}
      onDataChange={setData}
      onNodeEvent={(payload) => { if (payload.name === "click") console.log(data); }}
    />
  );
}
```

## 数据绑定要点

- 绑定**不是**节点上的 `bind` 字段，而是把 `props.modelValue` 写成表达式 `"{{scopeVar}}"`：
  - Vue 经 `VUE_BINDING`（默认 `modelValue` / `update:modelValue`）双向同步；
  - React 经 `REACT_BINDING`（`value` / `onChange`）双向同步。
- 宿主通过 `v-model:data`（Vue）/ `data` + `onDataChange`（React）拿到外部数据，带防回环。

## 事件通知

- `node-event`（Vue）/ `onNodeEvent`（React）是**只读通知**，拿到完整 `UiEventPayload`（事件名 `name`、节点 `node`、物料、页面 `scope`、原始参数、动作清单）；
- 返回 `false` 或调用 `payload.preventDefault()` 可拦截该事件配置的预设动作；**参与控制流**用 `onEvent`。

## 扩展仓（真实业务组件）

生产环境通常基于对应适配层的 `/kit` 子入口实现扩展仓（`design-vue-element-plus` 等），把引擎声明为 peer 以避免多副本。示例里的原生组件仅用于演示「零依赖最小集成」。

## 本地运行示例

```bash
pnpm --filter vue-example dev      # http://127.0.0.1:5174
pnpm --filter react-example dev    # http://127.0.0.1:5175
```

构建产物（CI 同款）即 GitHub Pages 的两个示例：`/` 为 Vue，`/react/` 为 React。
