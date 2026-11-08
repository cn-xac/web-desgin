# 发布到 npm

本仓（核心仓）发布三个可发布包，采用 **fixed 单版本组**：永远共用一个版本号，一次发布同时出三个 tarball。依据见 `ADR-15`（`docs/TASKS.md`）——版本不同步会产生兼容矩阵，维护成本远高于多打几个 tarball。

| 包 | 作用 | 依赖 | peerDependencies |
|---|---|---|---|
| `@x-ac/design-core` | 协议与内核（Schema / 物料 meta / 表达式 / 校验 / 导出 / 静态 HTML）+ 框架无关的通用工具（`parsePairs` / `defineAdapter` / `prefixedComponents` / `bindModel`）+ `UiEventPayload` 事件协议与 `loadPageData` 数据源取数 | 无 | 无 |
| `@x-ac/design-vue` | Vue 适配层：渲染器 + 设计器 + `/kit` 组件作者 SDK（多入口 `index` / `designer` / `kit`） | `@x-ac/design-core` | `vue`、`pinia`（仅设计器，可选） |
| `@x-ac/design-react` | React 适配层：渲染器 + `/kit` 组件作者 SDK（多入口 `index` / `kit`） | `@x-ac/design-core` | `react` |

私有包 `vue-design-workspace`（根）、`playground`、`react-demo` 不参与发布，版本号独立。

### 扩展包（独立仓库）

`vue-*` / `react-*` 扩展不属于本仓，各自一个仓库独立维护，**真实基于对应适配层的 `/kit` 子入口实现**：

| 扩展仓 | 运行时 import | peerDependencies |
|---|---|---|
| `design-vue-element-plus` | `@x-ac/design-vue/kit`（`defineVueAdapter` / `createDesignerKit` / `useFieldModel`）+ `@x-ac/design-core` | `@x-ac/design-core`、`@x-ac/design-vue`、`vue`、`element-plus` |
| 后续 `vue-icon-xxxx` | 同上 | `@x-ac/design-core`、`@x-ac/design-vue`、`vue`、图标库 |
| 后续 `react-ant` | `@x-ac/design-react/kit`（`defineReactAdapter`）+ `@x-ac/design-core` | `@x-ac/design-core`、`@x-ac/design-react`、`react`、`antd` |

扩展包把引擎声明为 peer 是**版本配套 + 防多副本**：`UI_ADAPTER` 注入符号由 `@x-ac/design-vue` 内部持有，扩展包不 import 它，因此不存在「扩展包与宿主各持一份 symbol」的问题；真正需要去重的是 `vue` 与 UI 库本体。`/kit` 子入口不加载 CSS / 渲染器，扩展包产物里它保持 external。扩展仓版本号与核心仓同一条版本线，发布顺序 `core → vue/react → 扩展`。

## 1. 版本治理脚本

`scripts/release.mjs` 动态发现 `packages/*` 下所有非 private 包，不维护硬编码清单，新增核心包自动纳入（扩展包在各自仓库单独发布）。

```bash
cd project
node scripts/release.mjs check                      # 校验一致性；不一致退出码 1
node scripts/release.mjs version minor --dry-run   # 只看计划，不写文件
node scripts/release.mjs version 0.4.0             # 批量改 3 个 package.json 的 version
node scripts/release.mjs publish                   # 只打印发布计划（默认 dry-run）
node scripts/release.mjs publish --yes             # 真正发布（必须单独批准）
```

`build:lib` 已前置 `release.mjs check`，版本漂移会直接阻断构建。根脚本别名：`pnpm release:check` / `pnpm release:version` / `pnpm release:publish`。

脚本边界（红线）：**不 push、不建 tag、不自动发布**。`--yes` 是唯一执行开关；tag 命令只在 `publish` 计划里作为提示文本出现，需要时人工执行 `git tag -s v0.4.0 -m "release 0.4.0"`。

版本参数支持 `patch` / `minor` / `major` 或显式 `x.y.z`（含 prerelease），并拒绝降级。改版本只替换 `package.json` 里第一个 `version` 字段，其余内容与换行风格原样保留。

## 2. 包名与 scope

三个包已定为 `@x-ac/design-*`。发布前先确认 scope 归属：

```bash
npm login
npm whoami
npm access list packages @x-ac    # 可选
```

换名字一条命令改全仓（会同步改包间依赖、源码 / 配置 alias / 文档里的 import）：

```bash
node scripts/rename-scope.mjs @your-scope
node scripts/rename-scope.mjs @your-scope --prefix ui-
pnpm install && pnpm build:lib && pnpm typecheck && pnpm test
```

## 3. 发布前自检

```bash
cd project
pnpm release:check   # 三包同版本
pnpm test            # 全部用例
pnpm typecheck       # 五个包类型检查（core / vue / react / playground / react-demo）
pnpm build:lib       # 构建 core / vue / react

# 检查 tarball 内容（不会真的发布）
pnpm --filter @x-ac/design-core pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-vue pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-react pack --pack-destination ../tmp/packs
```

确认点：

- `files` 只包含 `dist`、`README.md`、`LICENSE`，没有源码与测试；
- `dist` 无上次构建残留（各包 `build` 会先跑 `scripts/clean-dist.mjs`）；
- tarball 内 `dependencies` 的 `workspace:*` 已被替换为具体版本号（pnpm 在 pack/publish 时完成）；
- `dist/*.d.ts` 与 `exports` 声明的路径一一对应；
- Vue 侧 `index.js`（渲染器）不含设计器与 UI 库代码，设计器从 `./designer` 按需引入。

## 4. 发布

```bash
cd project
npm login                              # 或 pnpm login
node scripts/release.mjs publish       # 先看计划
node scripts/release.mjs publish --yes # 单独批准后执行
```

实际执行的是 `pnpm -r --filter "./packages/*" publish --access public`，顺序由 pnpm 按依赖拓扑自动决定（core → 两个适配层）。发布前会跑各包 `prepack`，等于再构建一次。

只想发某一个包时可直接 `pnpm --filter <name> publish --access public`，但**不要**让它脱离统一版本——下一次 `version` 会把所有包拉回同一版本号。

扩展仓在各自仓库执行 `pnpm publish --access public`；发版前先确认核心仓对应版本已在 npm 上，否则 peer 依赖解析不到。

## 5. 发布后验证

```bash
mkdir /tmp/check && cd /tmp/check
npm init -y && npm i @x-ac/design-core
node -e "import('@x-ac/design-core').then(m=>console.log(Object.keys(m).length))"
```

Vue / React 侧建议各跑一次 SSR 渲染：

```js
// Vue：装 @x-ac/design-vue + 扩展仓的 @x-ac/design-vue-element-plus，并注入 adapter
const html = await renderToString(createSSRApp({ render: () => h(SchemaRenderer, { page }) }));
// React
const html = renderToStaticMarkup(createElement(SchemaRenderer, { page }));
```

## 6. 私有 registry

把 `publishConfig.registry` 改成内网地址，或在 `.npmrc` 里配：

```ini
@your-scope:registry=https://npm.internal.example.com/
//npm.internal.example.com/:_authToken=${NPM_TOKEN}
```

## 7. 常见坑

- **`workspace:*` 未改写**：只在 `pnpm publish` / `pnpm pack` 时改写；直接 `npm publish` 会失败。
- **版本漂移**：有人手工改了单个包版本 → `build:lib` 会被 `release.mjs check` 挡住，用 `version` 统一回去。
- **peer 版本过窄**：`element-plus: ^2.6.0`、`vue: ^3.4.0`、`react: ^18 || ^19`，升级主版本前先放宽。
- **样式丢失**：CSS 通过 `exports["./style.css"]` 暴露，使用方需显式 `import "@x-ac/design-vue/style.css"`。
- **页面全是占位块**：宿主没注入 `UiAdapter`，用 `app.use(createVueDesign({ adapter: elementPlusAdapter }))`。
- **设计器报缺 pinia**：pinia 是可选 peer，只有用设计器才需要安装。
- **撤回**：`npm unpublish <pkg>@0.3.0 --force` 仅在发布 72 小时内可用，之后只能发新版本。
- **扩展包引擎多副本**：扩展仓把 `@x-ac/design-vue`（或 `design-react`）声明为 peer；风险来自宿主与扩展各装一份**引擎包**导致 `UI_ADAPTER` symbol 不同，扩展仓自身并不 import 该 symbol。
- **TypeScript 暂不能升 7.x**：`typescript@7.0.2` 是 native 重写版，`exports` 已移除 `./lib/tsc`，`vue-tsc@3.3.14` 启动即报 `ERR_PACKAGE_PATH_NOT_EXPORTED`，`tsc` / `vue-tsc` 全线不可用。两仓因此停在最新 5.x（`^5.9.3`），其余依赖均为 latest。再跑 `pnpm -r up --latest` 会把它拉回 7，升级后需回改；等 vue-tsc 提供 TS 7 兼容构建再放开。
- **Vite 8 / Vitest 5 配置**：Vite 8 用 `oxc` 取代 `esbuild`（`esbuild.jsx` 已废弃），且 SSR 环境不再自动给 `@vue/compiler-sfc` 注入 `fs`，跨文件 `defineProps<ImportedType>()` 需在 `vue()` 插件里显式传 `script.fs`；Vitest 4 起 `poolOptions` 移除，改用顶层 `fileParallelism: false`；`fsModuleCache` 会递归清 `node_modules/.vitest-cache`，受限沙箱需设 `false`。两侧 `vitest.config.ts` 已同步。
- **本地联调**：核心仓 `playground` 与 `tests` 用 `link:../../design-vue-element-plus` 加 vite/tsconfig 别名指向兄弟仓源码；扩展仓反向 `link:` 到本仓 `packages/core` / `packages/vue`。发版后把 `link:` 替换为版本号并移除别名，即可解绑。
