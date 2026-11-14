# AGENTS.md — @x-ac/web-design（AI 使用契约）

> 本文件供 AI 智能体直接阅读并据此使用该开发包。读完即可渲染页面、构造合法 `PageSchema`、注册自定义物料、做校验/导出、用设计器、跑构建与测试。所有签名均对应当前 `1.0.0` 源码。
>
> **AI 软件自动加载说明**：本 `AGENTS.md` 位于仓库根，Codex / Claude Code / Cursor / WorkBuddy 等智能体在打开本仓库时会自动加载本文件。无需 README 之外的额外引导；README 顶部亦已显式指向本文件。

## 0. AI 先读这些文件（自动加载索引）

本文件是给 AI 的入口。加载后按需精读以下源码/文档（路径相对仓库根）：

| 文件 | 用途 |
|---|---|
| `packages/core/src/schema/types.ts` | `PageSchema` / `NodeSchema` 类型定义（Schema 协议权威来源） |
| `packages/core/src/index.ts` | 内核公共 API 导出 |
| `packages/vue/src/index.ts` | Vue 包公共导出（`SchemaPage` / `SchemaRenderer` / `SchemaDesigner` 等） |
| `packages/vue/src/kit.ts` | Vue `/kit` 扩展仓 SDK 契约 |
| `packages/react/src/index.ts` | React 包公共导出 |
| `packages/react/src/kit.ts` | React `/kit` 扩展仓 SDK 契约 |
| `packages/vue/src/renderer/SchemaRenderer.vue` | Vue 渲染器入口（含 `children ?? []` 兜底） |
| `packages/react/src/SchemaRenderer.tsx` | React 渲染器入口（含 `children ?? []` 兜底） |
| `packages/core/src/materials/adapter.ts` | `UiAdapter` 适配包完整契约 |
| `packages/core/src/actions/registry.ts` | 8 个内置动作清单 |
| `packages/core/src/designer/repo.ts` | `PageRepository` 契约（设计器仓储） |
| `docs/EXAMPLES.md` · `docs/VALIDATION.md` · `docs/PUBLISH.md` | 三包协作 / 校验规则 / 发布链路 |

## 1. 心智模型（先读这段）

- **一份 `PageSchema` 是渲染与设计的唯一契约**。它是一棵 `NodeSchema` 树 + 页面级 `state` / `meta` / `dataSource`。
- 三包职责：
  - `@x-ac/web-design-core`：框架无关内核。Schema 类型、表达式、树操作、校验、数据导出、样式合并、动作协议、设计器状态机与页面仓储。**零依赖、不 import vue/react、不访问 `window`/`document`**，可在 Node / SSR / 单测跑。
  - `@x-ac/web-design-vue` / `@x-ac/web-design-react`：把 Schema 渲染成真实 UI，并提供设计器（Vue）与 `/kit` 扩展仓 SDK。
- **扩展点是 `UiAdapter`（适配包）**：宿主通过它注入「组件实现 + 物料元数据 + 双向绑定通道 + 动作副作用」。换 UI 库只换适配包，渲染器/设计器/内核都不用改。
- 真实 UI 库物料（Element Plus / antd）在**独立扩展仓**（如 `web-design-vue-element-plus`），基于对应适配层的 `/kit` 子入口实现，把内核声明为 `peerDependency`。

## 2. 仓库布局

```
packages/
  core/       @x-ac/web-design-core   （内核，src/ 即源码）
  vue/        @x-ac/web-design-vue    （Vue 适配层）
  react/      @x-ac/web-design-react  （React 适配层）
apps/
  vue-example/   react-example/       （零 UI 库最小演示，可本地起）
docs/         EXAMPLES.md / VALIDATION.md / PUBLISH.md
tests/        vitest 用例（跨框架契约测试）
scripts/      release.mjs / clean-dist.mjs / rename-scope.mjs
```

- 包管理器：**pnpm**（workspace）。命令均从仓库根 `packages` 上级（即本目录）执行。
- 三包同版本号（fixed version group，`1.0.0`）。`scripts/release.mjs check` 会校验版本一致。

## 3. 安装

```bash
# 最小（零 UI 库，渲染原生 input/select/button/table）
pnpm add @x-ac/web-design-vue @x-ac/web-design-core vue
pnpm add @x-ac/web-design-react @x-ac/web-design-core react react-dom

# 用 Element Plus 等：再装对应的扩展仓 + UI 库，并通过 /kit 组装适配包注入
```

## 4. 公共 API 参考

### 4.1 `@x-ac/web-design-core`

**类型（部分）**
- `PageSchema`：`{ schemaVersion: string; id: string; type: "page"; meta?: { title?, device?: "pc"|"pad"|"h5", ... }; state?: Record<string,unknown>; dataSource?: Record<string, DataSourceConfig>; children: NodeSchema[] }`
- `NodeSchema`：`{ id: string; component: string; props?: Record<string,unknown>; style?: Record<string,string|number>; directives?: DirectiveSchema[]; events?: Record<string, ActionSchema[]>; rules?: ValidationRule[]; dataSource?: ExternalDataSource; visibility?: VisibilityConfig; children?: NodeSchema[] }`
- `Material`：物料元数据（`component`/`title`/`category`/`kind`/`icon`/`defaultProps`/`fields`/`events?`/`acceptsChildren?`/`textProp?`/`isFormControl?`/`portable?` 等）
- `UiAdapter<T>`：适配包契约（见 §6）
- `DirectiveSchema`：`{ name: "show"|"if"|"for"; value?: string; itemKey?; indexKey? }`
- `ActionSchema`：`{ action: string; args?: Record<string,unknown> }`
- `ValidationRule`：`{ type: RuleType; value?; message?; when?; flags? }`

**核心函数**
- `createEmptyPage(title?): PageSchema` — 空页面工厂。
- `migratePage(input: unknown): { schema: PageSchema; applied: string[] }` — 任意版本/字符串 Schema → 当前版本；自动补 `meta`/`children` 默认结构。字符串会先 `JSON.parse`。
- `validatePage(input: unknown, knownComponents?: Set<string>): ValidationResult` — 结构校验（`error` 阻断保存/导入，`warning` 仅提示未知组件）。`assertValidPage(input, known?): PageSchema` 校验失败抛错。
- `validateData(page, scope, opts?): { valid, errors: FieldError[], byNode, checkedFields, checkedRules }` — 数据校验（用户填的值）。`validateNodeField(node, scope, errors?, catalog?)` 单字段校验（失焦用）。
- `exportData(page, scope, opts?: DataExportOptions): DataExportResult` — 收集表单数据。`DataExportOptions = { includeEmpty?, validate?, materials? }`。返回 `{ valid, data(嵌套), flat(扁平), fields, unbound, errors, exportedAt }`。`toDataJSON(result, { space?, includeMeta? })` 序列化为 JSON。
- `loadPageData(page, scope, opts?: LoadPageDataOptions): Promise<void>` — 执行 `page.dataSource`（http/static）。失败不抛错，只通过 `onError` 上报，页面不白屏。`LoadPageDataOptions = { fetchImpl?, signal?, onLoading?, onError? }`。`hasAutoHttpSource(page)` 判断是否有自动请求。
- `toJSON(page, space?): string` — 压缩序列化（默认值不落库，`diff` 友好）。`toHtml(page, ...)` 导出静态 HTML（在 `export/html`）。
- **物料/适配包工具**：
  - `defineMaterial(input: CustomMaterialInput): CustomMaterial` — 规范化一份业务物料声明（校验 `component` 非空、不得占用 `ec-` 协议命名空间）。
  - `registerMaterials(adapter, definitions, opts?: { overwrite? }): UiAdapter` — **不可变组合**，返回新 adapter（不改入参）；同名默认报错。
  - `withMaterials(adapter, materials: Material[]): UiAdapter` — 同理，直接给 `Material[]`。
  - `defineAdapter(options): UiAdapter` / `defineVueAdapter`(vue/kit) / `defineReactAdapter`(react/kit) — 组装适配包。
  - `prefixedComponents(table)` — 裸名映射表 → 协议名（`ec-` 前缀）映射表。
  - `bindModel(channel, value, onUpdate): Record<string,unknown>` — 生成受控属性片段。
  - `missingComponents(adapter): string[]` / `inspectAdapter(adapter): AdapterReport` — 启动自检。
  - `MATERIALS` — 内核内置协议物料清单（无 UI 实现，需适配包补 `components`）。
- **动作**：`ACTION_REGISTRY` / `ACTION_DEFINITIONS` / `ACTION_OPTIONS` / `runAction` / `runActions` / `createNoopAdapter()`。`ActionAdapter = { notify(msg, type), confirm(msg, title?): Promise<boolean> }`。
- **事件**：`createEventPayload(...)` / `toReactHandlerName(name)` / `camelizeEventName(name)` / `runEventHooks(payload, hooks)` / 类型 `UiEventPayload` / `UiEventHook`。
- **树操作**：`walk` / `findNode` / `findLocation` / `countNodes` / `maxDepth` / `insertNode` / `removeNode` / `moveNode` / `relocateNode` / `cloneWithNewIds` / `getBreadcrumb` / `createNodeId`。
- **设计器内核**：`DesignerStore`（状态机）、`PageRepository` / `PageRecord` / `createMemoryRepository(seed?)` / `setPageRepository(repo)` / `getPageRepository()`。
- **表达式/工具**：`resolveValue(expr, scope)` / `getByPath` / `setByPath` / `deepClone` / `materialKey` / `resolveNodeStyle` / `resolveDefaults` / `isBindable` / `resolveBoolean`。
- **显隐与多条件（1.1.0 起）**：`resolveVisibility(node, scope, external?, ctx?)`（优先级：外部 force → 本地 show → 本地 hide → 外部非强制 → 旧 directives → 默认显示）/ `resolveDirectiveVisibility` / `resolveLoopInstances` / `evaluateConditionGroup` / `evaluateConditionRow` / `validateAdvancedExpression` / `aggregateSeries` / `collectConditionElements`；类型 `VisibilityConfig` `ConditionGroup` `ConditionRow` `ExternalVisibility` `VisibilityDecision`。`collectConditionElements(page, { nodeId })` 是设计期条件源清单，按子表单单向裁剪。

### 4.2 `@x-ac/web-design-vue`

入口 `index`（渲染器，不含设计器与 CSS 副作用）：
- 组件：`SchemaRenderer`（=`SchemaPage`，语义化别名）、`SchemaNode`。
- 插件：`createVueDesign(options?: { adapter?, componentName?, pageComponentName? }): Plugin` 注册全局 `<SchemaRenderer>`/`<SchemaPage>` 并 `provide(UI_ADAPTER, adapter)`；`VueDesignPlugin = createVueDesign()`。
- `useMaterialCatalog()`、`useUiAdapter()`。
- 透传 core 的校验/导出/动作协议。
- 样式：`import "@x-ac/web-design-vue/style.css"`（渲染器+设计器+设计令牌）。

`/designer` 子入口：`SchemaDesigner`（=`DesignerView`）、`useDesignerStore()`、`createMemoryRepository`/`setPageRepository`/`getPageRepository` 等。
`/kit` 子入口：`defineVueAdapter(options)`、`useFieldModel(read, update, change?)`、`VUE_BINDING`、`createDesignerKit(kit)`、`bindModel`、`inspectAdapter`。
`/style.css`：样式入口。

`SchemaRenderer` props（关键）：`page: PageSchema | string`、`mode?: "view"|"edit"`、`design?`、`adapter?`、`data?`、`navigate?`、`onEvent?`。`v-model:data`、`@submit`、`@navigate`、`@node-event`。`defineExpose`：`scope` / `validate()` / `validateField(node)` / `getData(opts?)` / `getErrors()` / `reset()` / `setData(patch)`。**对畸形 Schema（`children` 缺失）已兜底为空数组，不会崩。**

### 4.3 `@x-ac/web-design-react`

入口 `index`：
- `SchemaRenderer`（ref 暴露 `SchemaRendererHandle`：`validate()` / `getData()` / `exportData()` / `getErrors()` / `reset()` / `setData()` / `reload()` / `scope`）。
- `SchemaNode`、`isActionRegistered()`。
- `ReactDesignProvider({ adapter, children })` / `createReactDesign(adapter)` / `useUiAdapter()`。
- `nativeAdapter`（内置原生元素适配包）、`createReactAdapter` / `defaultAdapter`。
- `usePageStore()`（底层 store，一般不用）。
- 透传 core 的校验/导出/事件协议。
- 样式：`import "@x-ac/web-design-react/style.css"`。

`/designer` 子入口：`SchemaDesigner`（ref `SchemaDesignerHandle`：`exportSchema()`/`exportHtml()`/`importSchema(json)`/`save()`）、`DesignerStore`、`createMemoryRepository`、`DesignerDialogsProvider` / `useDesignerDialogs()`（设计器六个弹窗：绑定选择 / 选项录入 / 外部数据源 / 显示隐藏条件 / 子映射 / 请求头）、`ModalShell`、`HelpTip`、`NativeTooltip`。
`/kit` 子入口：`defineReactAdapter(options)`、`useFieldModel(value, update, channel?)`、`REACT_BINDING`(value/onChange)、`createDesignerKit(kit)`、`bindModel`、`inspectAdapter`。
`/style.css`：样式入口。

`SchemaRenderer` props（关键）：`page`、`mode?`、`design?`、`ui?`(适配包)、`adapter?`(动作副作用)、`data?`、`onDataChange?`、`onSubmit?`、`onEvent?`、`onNodeEvent?`、`navigate?`。**根级 `schema.children` 已兜底 `?? []`，畸形 Schema 安全降级。**

## 5. PageSchema 协议（写 JSON 的依据）

```jsonc
{
  "schemaVersion": "1.1.0",
  "id": "page_employee",
  "type": "page",
  "meta": { "title": "员工登记", "device": "pc" },
  "state": { "form": { "name": "" } },          // 页面级响应式初值 → scope
  "dataSource": {                                // 可选；键名即 scope 变量名
    "options": { "type": "http", "url": "/api/options", "auto": true }
  },
  "children": [
    {
      "id": "n_name", "component": "input",
      "props": { "label": "姓名", "modelValue": "{{form.name}}" },   // 绑定：表达式
      "rules": [{ "type": "required" }, { "type": "maxLength", "value": 20 }],
      "events": { "change": [{ "action": "setState", "args": { "path": "form.name", "value": "{{$event}}" } }] }
    }
  ]
}
```

- `component`：物料名；业务物料建议 `biz-` 前缀，**不得占用 `ec-` 协议命名空间**。
- 绑定：把 `props.modelValue` 写成 `"{{scopeVar}}"`，引擎按路径双向同步（Vue `modelValue/update:modelValue`，React `value/onChange`）。
- 校验规则 `rules[].type`：`required`/`minLength`/`maxLength`/`min`/`max`/`pattern`(可带 `flags`)/`email`/`phone`/`integer`；通用 `message`(支持 `{label}`/`{value}`)、`when`(条件表达式)。
- 指令 `directives`：`show`/`if`(布尔表达式控制显隐)、`for`(`value` 遍历表达式，`itemKey`/`indexKey` 别名)。**旧指令保留兼容**，新页面优先用 `visibility`。
- `visibility`：`{ show?: ConditionGroup; hide?: ConditionGroup }`，配置在目标节点自身、只控制自身；显示高于隐藏。条件行 `left` / `aggregate` / `operator` / `value`，`mode` 为 `and` | `or` | `advanced`（`expression` 如 `1 and (2 or 3)`）。子表单内只能引用同一子表单，子表单外引用明细字段需 `aggregate: sum|avg|min|max`（缺省 sum）。宿主可用 `SchemaRenderer` 的 `visibility` prop 按节点 id 传 `{ visible, force? }`。
- 事件 `events`：键为事件名（kebab 如 `row-click`，引擎转 `rowClick`/`onRowClick`）；值为 `ActionSchema[]`。

## 6. UiAdapter 适配包契约

```ts
interface UiAdapter<T = unknown> {
  name: string;                                  // 如 "element-plus"
  components: Record<string, T>;                 // 协议名(ec-input) → 组件实现
  materials: Material[];                         // 物料元数据（面板/校验唯一数据源）
  binding?: { prop: string; event: string };     // 缺省 Vue: modelValue / onUpdate:modelValue
  designer?: {                                   // 设计器自身 UI 控件，全可选，未给回落原生
    Button?, Input?, NumberInput?, Select?, Switch?, Segmented?, ColorInput?,
    notify?(msg, type?) };
  editors?: Partial<Record<PropFieldType, T>>;    // 覆盖属性面板的字段编辑器
  provider?: T;                                  // 主题/语言/消息上下文外层包装（如 ElConfigProvider）
  propAliases?: Record<string, string>;          // 通用属性名 → UI 库真实属性名（仅透传普通属性）
  actions?: ActionAdapter;                       // notify / confirm 副作用
  onEvent?: UiEventHook;                         // 事件归一化/拦截，在宿主 onEvent 之前
}
```

组装请用工厂：`defineAdapter`(core) / `defineVueAdapter`(vue/kit) / `defineReactAdapter`(react/kit)。**约束：自定义物料组件必须把 `style` 应用到根元素**，否则通用 margin/padding 失效。

## 7. 渲染一个页面（最小可跑）

**Vue（全局注入适配包，标签即用）**
```ts
import { createVueDesign } from "@x-ac/web-design-vue";
import { elementPlusAdapter } from "@x-ac/web-design-vue-element-plus"; // 扩展仓
import "@x-ac/web-design-vue/style.css";
app.use(createVueDesign({ adapter: elementPlusAdapter }));
```
```vue
<SchemaPage :page="page" v-model:data="formData" @submit="onSubmit" />
```

**Vue（组件级，不装插件）**
```vue
<SchemaRenderer :page="page" :adapter="adapter" v-model:data="formData" :on-event="onEvent" @node-event="track" />
```

**React（Provider 注入，跨多页面共用）**
```tsx
import { ReactDesignProvider, SchemaRenderer } from "@x-ac/web-design-react";
<ReactDesignProvider adapter={elementPlusAdapter}>
  <SchemaRenderer page={page} />
</ReactDesignProvider>
```
**React（单组件，用内置原生适配包 + 业务物料）**
```tsx
import { SchemaRenderer, nativeAdapter, registerMaterials } from "@x-ac/web-design-react";
const adapter = registerMaterials(nativeAdapter, [{ component: "biz-rate", title: "满意度", kind: "field", impl: Rate, fields: [{ key: "max", label: "最高分", type: "number" }] }]);
<SchemaRenderer ref={ref} page={page} ui={adapter} data={data} onDataChange={setData} onSubmit={onSubmit} />;
```

## 8. 注册自定义物料（不改内核）

```ts
import { registerMaterials } from "@x-ac/web-design-react"; // 或 core
import { nativeAdapter } from "@x-ac/web-design-react";

const adapter = registerMaterials(nativeAdapter, [
  {
    component: "biz-rate",            // 建议 biz- 前缀
    title: "满意度",
    kind: "field",                   // layout|display|field|action|subform
    category: "业务",
    impl: Rate,                      // Vue 组件 / React 组件 / 原生标签字符串
    props: { modelValue: 0, max: 5 },
    fields: [{ key: "max", label: "最高分", type: "number" }], // 属性面板编辑方式
    events: [{ name: "change", title: "变更" }],
    isFormControl: true,
  },
]);
```
也可先 `defineMaterial(input)` 再 `registerMaterials(adapter, [customMaterial])`。返回**新 adapter**，谁注入谁生效（无全局可变注册表，SSR/并行测试安全）。

## 9. 动作清单（Schema 内 `events[x].action`）

| action | 含义 | args |
|---|---|---|
| `toast` | 轻提示 | `text`, `type`(success/warning/error/info) |
| `setState` | 写状态 | `path`, `value` |
| `submitForm` | 校验后把对象插入列表 | `from`, `to`, `fields?`, `validate?`, `reset?`, `successText?`（`onFormSubmit` 抛数据，校验失败不触发） |
| `resetForm` | 重置某表单对象 | `path`(默认 form) |
| `resetState` | 恢复 state 初值 | — |
| `clearList` | 清空数组 | `path`(默认 list) |
| `navigate` | 页面跳转（交给宿主 `navigate` prop） | `to` |
| `confirm` | 二次确认后执行 `then` | `text`, `then: ActionSchema[]` |

副作用 `notify`/`confirm` 由 `UiAdapter.actions`（扩展仓）或渲染器兜底提供；无 UI 环境用 `createNoopAdapter()`。

## 10. 设计器

```ts
import { SchemaDesigner } from "@x-ac/web-design-vue/designer";  // 或 react/designer
import { createMemoryRepository } from "@x-ac/web-design-core";
const repo = createMemoryRepository([page]);

// Vue
<SchemaDesigner :page-id="pageId" :repository="repo" @saved="onSaved" @export-schema="onExport" />
// React
<SchemaDesigner pageId={pageId} repository={repo} onSaved={onSaved} ref={ref} />
```
- `PageRepository = { list(): PageRecord[]; get(id): PageRecord|undefined; save(schema): PageRecord; remove(id): void }`。不注入时用内存兜底。
- 设计器不内置路由：跳转通过事件（`@back`/`@preview`/`onBack`/`onPreview`）交给宿主。
- Vue 设计器需 `pinia`（可选 peer）；React 设计器用 `useSyncExternalStore` 消费同一份 core `DesignerStore`。
- ref API：`exportSchema()` / `exportHtml()` / `importSchema(json)`（走 migrate→validate→可撤销替换）/ `save()`。

## 11. 构建 / 测试 / 类型检查

```bash
cd <repo-root>
pnpm install                      # 安装 workspace 依赖
pnpm --filter @x-ac/web-design-vue typecheck      # vue-tsc
pnpm --filter @x-ac/web-design-react typecheck    # tsc
pnpm --filter @x-ac/web-design-core typecheck
pnpm test                         # vitest（跨框架契约测试）
pnpm build:lib                   # 构建 core / vue / react 到各自 dist（prepack 也会构建）
pnpm release:check               # 三包同版本校验
# 本地起演示
pnpm --filter vue-example dev    # http://127.0.0.1:5174
pnpm --filter react-example dev   # http://127.0.0.1:5175
```
各包 `build` 会先 `scripts/clean-dist.mjs` 清残留；core 用 `tsc -p tsconfig.build.json`，vue/react 用 `vite build`（多入口 `index`/`designer`/`kit`/`style.css`）。

## 12. 约束与红线

- **core 不 import vue/react 任何东西，不访问 `window`/`document`**；所有副作用经参数注入（如 `loadPageData` 的 `fetchImpl`）。
- **fixed 单版本组**：三包版本必须一致，靠 `release.mjs check` 强约束；不要单独改某个包版本。
- **适配包是应用级单例**：页面内不支持运行时切换；换库需重建 Provider/插件根组件。
- **无全局可变物料注册表**：注册一律返回新 adapter（SSR/并行测试安全）。
- `workspace:*` 依赖只在 `pnpm publish`/`pack` 时改写为具体版本；直接 `npm publish` 会失败。

## 13. 已知坑

- **必须显式引样式**：`import "@x-ac/web-design-vue/style.css"`（或 react 版），否则布局/令牌丢失。
- **页面全占位块**：宿主没注入 `UiAdapter`（忘了 `createVueDesign({adapter})` / `ReactDesignProvider`）。
- **TypeScript 停在 5.x**：`typescript@7` 是 native 重写，`vue-tsc@3.3.14` 启动即报错；别升 7。
- **Vite 8 / Vitest 5+**：Vite 8 用 `oxc` 取代 `esbuild`；跨文件 `defineProps<ImportedType>()` 需在 `vue()` 插件传 `script.fs`；Vitest 4+ 移除 `poolOptions`（改用顶层 `fileParallelism: false`）。
- **发布走 OIDC（无 token）**：CI 用 `v* ` tag 触发 `publish.yml`，`--provenance` 发布；本地不推 tag、不建 tag、不自动发布。
- **扩展性**：业务物料默认 `portable: false`（不参加跨库一致性测试、静态导出走占位）；只有 `impl` 用协议内通用 DOM 语义时才置 `true`。

## 14. 近期变更（供 AI 注意）

- `SchemaRenderer`（vue `SchemaRenderer.vue` 与 react `SchemaRenderer.tsx`）现已对根级 `schema.children` 兜底 `?? []`：畸形 Schema（缺 `children`）不再在渲染入口崩溃，安全降级为空态。递归的 `SchemaNode` 此前已对 `node.children` 兜底。
- `schemaVersion` 已升 `1.1.0`（迁移链 `1.0.0 → 1.1.0`，旧结构无需变换）。新增节点级 `visibility` 显隐契约与通用多条件组件；`if` / `show` / `for` 的判定统一收敛到 core 的 `resolveVisibility` / `resolveLoopInstances`，Vue / React / 静态 HTML 三端共用。两端 `SchemaRenderer` 新增 `visibility` prop 支持外部强制控制；子表单的显隐求值使用行级隔离 scope。详见 `docs/INTEGRATION.md` 第 11 节。
- React 设计器已与 Vue 验收版对齐：新增 `DesignerDialogsProvider` 承载六个弹窗（绑定选择 / 选项录入 / 外部数据源 / 显示隐藏条件 / 子映射 / 请求头），属性面板补齐「外部数据源」入口与选项弹窗入口，条件配置由内联区块改为弹窗（`ConditionBuilder` 现为 `ConditionTrigger` 的兼容别名），并新增 `ModalShell` / `HelpTip` / `NativeTooltip` 与对应样式。弹窗状态挂在设计器实例上（Context），不使用全局单例，多实例与测试互不污染。
