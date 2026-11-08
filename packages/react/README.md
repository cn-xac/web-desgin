# @x-ac/design-react

React 适配层：用同一份 `PageSchema` 渲染页面，内置表单校验与数据导出，并给 `react-*` 扩展仓提供组件作者 SDK（`@x-ac/design-react/kit`）。

没有绑定任何 UI 库——默认映射到原生元素（input / select / table / button），所以只有 4 KB gzip；要换 antd / MUI，用 `/kit` 组装独立扩展仓即可。

## 安装

```bash
pnpm add @x-ac/design-react @x-ac/design-core react react-dom
```

## 用法

```tsx
import { useRef } from "react";
import { SchemaRenderer } from "@x-ac/design-react";
import type { SchemaRendererHandle } from "@x-ac/design-react";
import "@x-ac/design-react/style.css";

export function Form({ page }: { page: PageSchema }) {
  const ref = useRef<SchemaRendererHandle>(null);

  function submit() {
    if (!ref.current?.validate()) return;   // 错误会显示到字段下方
    const { data, flat } = ref.current.getData();
    api.submit(data);
  }

  return (
    <>
      <SchemaRenderer ref={ref} page={page} navigate={(to) => router.push(to)} />
      <button onClick={submit}>提交</button>
    </>
  );
}
```

通过 ref 暴露：

| 成员 | 说明 |
|---|---|
| `validate()` | 校验整页，返回 `boolean`，错误同时渲染到字段 |
| `getData(options?)` | 返回 `{ data, flat, fields, errors, valid }` |
| `getErrors()` | 当前 `nodeId -> 文案` |
| `reset()` | 恢复 `page.state` 初值并清空错误 |
| `scope` | 当前页面状态（普通对象） |

字段失焦会自动单字段校验（原生 input / textarea / select / range）。

## 应用级注入扩展仓（对齐 Vue）

Vue 侧用 `app.use(createVueDesign({ adapter }))` 一次注入，整棵组件树共用一份适配包；React 侧用 Context 表达同一语义：

```tsx
import { ReactDesignProvider, SchemaRenderer } from "@x-ac/design-react";
import { antAdapter } from "@x-ac/design-react-ant";  // 未来的独立扩展仓

export function App() {
  return (
    <ReactDesignProvider adapter={antAdapter}>
      <SchemaRenderer page={pageA} />
      <SchemaRenderer page={pageB} />
    </ReactDesignProvider>
  );
}
```

也可以把 adapter 预绑定成组件，形态更接近 `createVueDesign()`：

```tsx
const DesignProvider = createReactDesign(antAdapter);
<DesignProvider><App /></DesignProvider>
```

优先级：`ui` prop > 最近一层 `ReactDesignProvider` > 内置 `nativeAdapter`。`useUiAdapter()` 可在任意子组件里读当前适配包（不在 Provider 内返回 `null`）。

> 与 Vue 一样，适配包是**应用级单例**，页面内不支持运行时切换；换库请重建 Provider 所在的根组件。

## 校验规则

规则来自 `node.rules`，与 Vue 层完全同一套实现：

```ts
{
  id: "name",
  component: "input",
  props: { label: "姓名", modelValue: "{{form.name}}" },
  rules: [
    { type: "required" },
    { type: "minLength", value: 2 },
    { type: "maxLength", value: 20 },
  ],
}
```

支持的 `type`：`required` / `minLength` / `maxLength` / `min` / `max` / `pattern` / `email` / `phone` / `integer`，可用 `message` 自定义文案、`when` 配条件。

## 换成自己的 UI 库

**推荐做法**：用扩展仓提供的 `UiAdapter`，或 `registerMaterials()` 做不可变组合，在应用根部注入一次：

```tsx
import { ReactDesignProvider, SchemaRenderer, nativeAdapter, registerMaterials } from "@x-ac/design-react";

const adapter = registerMaterials(nativeAdapter, [
  { component: "biz-rate", title: "满意度", impl: BizRate, fields: [{ key: "text", label: "文案", type: "text" }] },
]);

<ReactDesignProvider adapter={adapter}>
  <SchemaRenderer page={page} />
</ReactDesignProvider>
```

**最小改动兼容做法**：直接改内置映射表。全局可变，SSR 多请求与并行测试有串味风险，不建议用于生产。

```tsx
import { COMPONENTS } from "@x-ac/design-react";
COMPONENTS.input = (props) => <Input {...props} />;
```

约束只有一条：**组件必须把 `style` 应用到根元素**，否则通用 margin / padding 失效。

## 给 react-* 扩展仓用的适配层 SDK

`react-*` 扩展仓（未来的 `react-ant` 等）基于 `/kit` 子入口实现，与 Vue 侧 `@x-ac/design-vue/kit` 对称：

```tsx
import { defineReactAdapter, useFieldModel, REACT_BINDING } from "@x-ac/design-react/kit";

export const antAdapter = defineReactAdapter({
  name: "antd",
  components: prefixedComponents(COMPONENT_TABLE),
  materials: antMaterials,
  actions: antActions,
  binding: REACT_BINDING, // value / onChange
});
```

`/kit` 是纯 TS 子入口，不加载 `styles.css` 与渲染器 Context；框架无关的协议与工具统一在 `@x-ac/design-core`。`nativeAdapter` 本身也由 `defineReactAdapter` 组装，可作为扩展仓的基座。

**两个可选协议字段由渲染器真实消费**：`provider` 作为外层上下文包装（主题 / 语言 / 消息），配置后包住整棵渲染树，未配置时不产生额外 DOM；`propAliases` 把 Schema 通用属性名映射成 UI 库真实属性名（如 `{ maxlength: "maxLength" }`），只作用于透传给组件的普通属性，不碰绑定通道与事件名。

## 节点事件回调

每个节点事件触发时，组件派发的原始参数会被包装成 `UiEventPayload`，**形状与 Vue 侧完全一致**，跨框架写业务钩子不用改代码。三个入口按需选：

| 入口 | 适用场景 | 能否阻断预设动作 |
|---|---|---|
| Schema 表达式 `$event` / `$args` / `$value` | 只读事件参数，不写代码 | 否 |
| `onEvent={fn}` | 业务侧接管、按参数改写状态 | 是（返回 `false` 或 `preventDefault()`） |
| `adapter.onEvent` | 扩展仓统一归一化自家 UI 库的事件参数 | 是 |
| `onNodeEvent={fn}` | 埋点 / 日志 / 镜像状态，只读不干预 | 否 |

```tsx
import { SchemaRenderer } from "@x-ac/design-react";
import type { UiEventPayload } from "@x-ac/design-react";

function onEvent(p: UiEventPayload): void | false {
  const [row] = p.args as [{ id: number }?];
  if (!row) return false;
  p.scope.currentId = row.id;  // scope 就是页面状态，可直接写
}

<SchemaRenderer page={page} ui={adapter} onEvent={onEvent} onNodeEvent={(p) => track(p.name, p.nodeId)} />;
```

`onNodeEvent` 拿到的是同一个 `UiEventPayload` 对象（能看到 `adapter.onEvent` 与 `onEvent` 对 `args` 的改写），在钩子之后、预设动作之前触发；即使被 `preventDefault()` 阻断也照常通知，适合做与业务控制流解耦的埋点。

事件名写 kebab（`row-click`）即可，渲染器内部转成 React 的 `onRowClick`。Schema 里也能直接引用，无需写 JS：

```json
{ "events": { "row-click": [
  { "action": "setState", "args": { "path": "form.name", "value": "{{$event.value.name}}" } }
] } }
```

`$event` 只叠加到表达式的读取作用域，不会写进 `page.state`，也不会出现在 `onDataChange` 的回传数据里。

## 运行时能力（与 Vue 对齐）

同一份 `PageSchema` 在两框架行为一致：`if` / `for` / `show` 指令、表达式、物料默认值、样式合并、双向绑定、动作、校验、数据导出、任意事件名与完整事件 payload、`dataSource`（http / static，取数逻辑共用 core 的 `loadPageData`）、`data` + `onDataChange` 双向同步（带防回环）、`onSubmit` 出口、只读事件通知 `onNodeEvent`、字符串 Schema 自动迁移、按 `meta.device` 设置画布宽度、失焦单字段校验。

ref API：`validate()` / `getData()` / `exportData()` / `getErrors()` / `reset()` / `setData()` / `reload()` / `scope`。

## 与 Vue 版差异

| 项 | Vue | React |
|---|---|---|
| 扩展仓 SDK | `@x-ac/design-vue/kit`：`defineVueAdapter` / `useFieldModel` | `@x-ac/design-react/kit`：`defineReactAdapter` / `useFieldModel` |
| 适配包注入 | `app.use(createVueDesign({ adapter }))` + `UI_ADAPTER` InjectionKey | `<ReactDesignProvider adapter>` / `createReactDesign()` + `UI_ADAPTER_CONTEXT` |
| 事件钩子 | `:on-event` / `@node-event`（只读通知） | `onEvent` / `onNodeEvent` prop |
| 外部数据 | `v-model:data` / `@submit` | `data` + `onDataChange` / `onSubmit` |
| 未注入时 | 降级为未知组件占位 | 回落内置 `nativeAdapter`（原生元素） |
| 双向绑定 | `modelValue` + `@update:modelValue` | `value` + `onChange` |
| 响应式 | `reactive(scope)` 自动重渲染 | 手动 `flush()`（core 的 `setByPath` 只改对象） |
| 失焦校验 | 外层 `focusout` 冒泡，不依赖 UI 库派发 blur | 组件 `onBlur`，依赖控件转发该事件 |
| 设计器 | 有，支持 `DesignerKit` 换肤 | 暂无；`UiAdapter.designer / editors` 在 React 侧尚未消费（`provider` / `propAliases` 已消费） |

## License

MIT
