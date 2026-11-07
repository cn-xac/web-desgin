# 发布到 npm

四个可发布包采用 **fixed 单版本组**：永远共用一个版本号，一次发布同时出四个 tarball。依据见 `ADR-15`（`docs/TASKS.md`）——版本不同步会产生兼容矩阵，维护成本远高于多打几个 tarball。

| 包 | 作用 | peerDependencies |
|---|---|---|
| `@x-ac/design-core` | 协议与内核（Schema / 物料 meta / 表达式 / 校验 / 数据导出 / 静态 HTML） | 无 |
| `@x-ac/design-vue` | Vue 3 引擎（渲染器 + 设计器 + 原生控件兜底） | `vue`、`pinia`（仅设计器，可选） |
| `@x-ac/design-vue-element-plus` | Element Plus 适配包（物料、绑定通道、动作、设计器控件） | `vue`、`element-plus` |
| `@x-ac/design-react` | React 引擎（渲染器 + 原生元素物料） | `react` |

私有包 `vue-design-workspace`（根）、`playground`、`react-demo` 不参与发布，版本号独立。

## 1. 版本治理脚本

`scripts/release.mjs` 动态发现 `packages/*` 下所有非 private 包，不维护硬编码清单，新增包自动纳入。

```bash
cd project
node scripts/release.mjs check                      # 校验一致性；不一致退出码 1
node scripts/release.mjs version minor --dry-run   # 只看计划，不写文件
node scripts/release.mjs version 0.4.0             # 批量改 4 个 package.json 的 version
node scripts/release.mjs publish                   # 只打印发布计划（默认 dry-run）
node scripts/release.mjs publish --yes             # 真正发布（必须单独批准）
```

`build:lib` 已前置 `release.mjs check`，版本漂移会直接阻断构建。根脚本别名：`pnpm release:check` / `pnpm release:version` / `pnpm release:publish`。

脚本边界（红线）：**不 push、不建 tag、不自动发布**。`--yes` 是唯一执行开关；tag 命令只在 `publish` 计划里作为提示文本出现，需要时人工执行 `git tag -s v0.4.0 -m "release 0.4.0"`。

版本参数支持 `patch` / `minor` / `major` 或显式 `x.y.z`（含 prerelease），并拒绝降级。改版本只替换 `package.json` 里第一个 `version` 字段，其余内容与换行风格原样保留。

## 2. 包名与 scope

四个包已定为 `@x-ac/design-*`。发布前先确认 scope 归属：

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
pnpm release:check   # 四包同版本
pnpm test            # 全部用例
pnpm typecheck       # 六个包类型检查
pnpm build:lib       # 构建 core / vue / vue-element-plus / react

# 检查 tarball 内容（不会真的发布）
pnpm --filter @x-ac/design-core pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-vue pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-vue-element-plus pack --pack-destination ../tmp/packs
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

实际执行的是 `pnpm -r --filter "./packages/*" publish --access public`，顺序由 pnpm 按依赖拓扑自动决定（core → 引擎 → 适配包）。发布前会跑各包 `prepack`，等于再构建一次。

只想发某一个包时可直接 `pnpm --filter <name> publish --access public`，但**不要**让它脱离统一版本——下一次 `version` 会把所有包拉回同一版本号。

## 5. 发布后验证

```bash
mkdir /tmp/check && cd /tmp/check
npm init -y && npm i @x-ac/design-core
node -e "import('@x-ac/design-core').then(m=>console.log(Object.keys(m).length))"
```

Vue / React 侧建议各跑一次 SSR 渲染：

```js
// Vue（需同时装 @x-ac/design-vue + @x-ac/design-vue-element-plus 并注入 adapter）
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
