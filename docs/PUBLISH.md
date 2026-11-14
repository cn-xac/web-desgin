# 发布到 npm

本仓（核心仓）发布三个可发布包，采用 **fixed 单版本组**：永远共用一个版本号，一次发布同时出三个 tarball。依据见 `ADR-15`（`docs/TASKS.md`）——版本不同步会产生兼容矩阵，维护成本远高于多打几个 tarball。

| 包 | 作用 | 依赖 | peerDependencies |
|---|---|---|---|
| `@x-ac/web-design-core` | 协议与内核（Schema / 物料 meta / 表达式 / 校验 / 导出 / 静态 HTML）+ 框架无关的通用工具（`parsePairs` / `defineAdapter` / `prefixedComponents` / `bindModel`）+ `UiEventPayload` 事件协议与 `loadPageData` 数据源取数 | 无 | 无 |
| `@x-ac/web-design-vue` | Vue 适配层：渲染器 + 设计器 + `/kit` 组件作者 SDK（多入口 `index` / `designer` / `kit`） | `@x-ac/web-design-core` | `vue`、`pinia`（仅设计器，可选） |
| `@x-ac/web-design-react` | React 适配层：渲染器 + `/kit` 组件作者 SDK（多入口 `index` / `kit`） | `@x-ac/web-design-core` | `react` |

私有包 `vue-design-workspace`（根）、`vue-example`、`react-example` 不参与发布，版本号独立。

### 扩展包（独立仓库）

`vue-*` / `react-*` 扩展不属于本仓，各自一个仓库独立维护，**真实基于对应适配层的 `/kit` 子入口实现**：

| 扩展仓 | 运行时 import | peerDependencies |
|---|---|---|
| `web-design-vue-element-plus` | `@x-ac/web-design-vue/kit`（`defineVueAdapter` / `createDesignerKit` / `useFieldModel`）+ `@x-ac/web-design-core` | `@x-ac/web-design-core`、`@x-ac/web-design-vue`、`vue`、`element-plus` |
| 后续 `vue-icon-xxxx` | 同上 | `@x-ac/web-design-core`、`@x-ac/web-design-vue`、`vue`、图标库 |
| 后续 `react-antd` | `@x-ac/web-design-react/kit`（`defineReactAdapter`）+ `@x-ac/web-design-core` | `@x-ac/web-design-core`、`@x-ac/web-design-react`、`react`、`antd` |

扩展包把引擎声明为 peer 是**版本配套 + 防多副本**：`UI_ADAPTER` 注入符号由 `@x-ac/web-design-vue` 内部持有，扩展包不 import 它，因此不存在「扩展包与宿主各持一份 symbol」的问题；真正需要去重的是 `vue` 与 UI 库本体。`/kit` 子入口不加载 CSS / 渲染器，扩展包产物里它保持 external。扩展仓版本号与核心仓同一条版本线，发布顺序 `core → vue/react → 扩展`。

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

三个包已定为 `@x-ac/web-design-*`。发布前先确认 scope 归属：

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
pnpm typecheck       # 类型检查（core / vue / react / vue-example / react-example）
pnpm build:lib       # 构建 core / vue / react

# 检查 tarball 内容（不会真的发布）
pnpm --filter @x-ac/web-design-core pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/web-design-vue pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/web-design-react pack --pack-destination ../tmp/packs
```

确认点：

- `files` 只包含 `dist`、`README.md`、`LICENSE`，没有源码与测试；
- `dist` 无上次构建残留（各包 `build` 会先跑 `scripts/clean-dist.mjs`）；
- tarball 内 `dependencies` 的 `workspace:*` 已被替换为具体版本号（pnpm 在 pack/publish 时完成）；
- `dist/*.d.ts` 与 `exports` 声明的路径一一对应；
- Vue 侧 `index.js`（渲染器）不含设计器与 UI 库代码，设计器从 `./designer` 按需引入；React 侧同构：`dist/index.js` 约 1.3 kB，`dist/designer.js` 约 55 kB，`dist/style.css` 同时含渲染器与设计器样式；
- 两仓的 `./designer`、`./kit`、`./style.css` 三类子入口都在 `exports` 里声明，且 `dist/*.d.ts` 齐全（core 的 `DesignerStore` / `PageRepository` 类型由 core 发布，不在适配层重复声明）。

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
npm init -y && npm i @x-ac/web-design-core
node -e "import('@x-ac/web-design-core').then(m=>console.log(Object.keys(m).length))"
```

Vue / React 侧建议各跑一次 SSR 渲染：

```js
// Vue：装 @x-ac/web-design-vue + 扩展仓的 @x-ac/web-design-vue-element-plus，并注入 adapter
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
- **样式丢失**：CSS 通过 `exports["./style.css"]` 暴露，使用方需显式 `import "@x-ac/web-design-vue/style.css"`。
- **页面全是占位块**：宿主没注入 `UiAdapter`，用 `app.use(createVueDesign({ adapter: elementPlusAdapter }))`。
- **设计器报缺 pinia**：pinia 是可选 peer，只有用设计器才需要安装。
- **撤回**：`npm unpublish <pkg>@0.3.0 --force` 仅在发布 72 小时内可用，之后只能发新版本。
- **扩展包引擎多副本**：扩展仓把 `@x-ac/web-design-vue`（或 `design-react`）声明为 peer；风险来自宿主与扩展各装一份**引擎包**导致 `UI_ADAPTER` symbol 不同，扩展仓自身并不 import 该 symbol。
- **TypeScript 暂不能升 7.x**：`typescript@7.0.2` 是 native 重写版，`exports` 已移除 `./lib/tsc`，`vue-tsc@3.3.14` 启动即报 `ERR_PACKAGE_PATH_NOT_EXPORTED`，`tsc` / `vue-tsc` 全线不可用。两仓因此停在最新 5.x（`^5.9.3`），其余依赖均为 latest。再跑 `pnpm -r up --latest` 会把它拉回 7，升级后需回改；等 vue-tsc 提供 TS 7 兼容构建再放开。
- **Vite 8 / Vitest 5 配置**：Vite 8 用 `oxc` 取代 `esbuild`（`esbuild.jsx` 已废弃），且 SSR 环境不再自动给 `@vue/compiler-sfc` 注入 `fs`，跨文件 `defineProps<ImportedType>()` 需在 `vue()` 插件里显式传 `script.fs`；Vitest 4 起 `poolOptions` 移除，改用顶层 `fileParallelism: false`；`fsModuleCache` 会递归清 `node_modules/.vitest-cache`，受限沙箱需设 `false`。两侧 `vitest.config.ts` 已同步。
- **本地联调**：核心仓 `tests` 用 `link:../../design-vue-element-plus` 加 vite/tsconfig 别名指向兄弟仓源码；扩展仓反向 `link:` 到本仓 `packages/core` / `packages/vue`。发版后把 `link:` 替换为版本号并移除别名，即可解绑。

## 8. 自动化发布（GitHub Actions）

发布流程已搬到 `.github/workflows/publish.yml`。**不在 Actions 里调用 `scripts/release.mjs`**，而是直接用 pnpm 发布当前 `package.json` 里的版本（即 latest）。

### 触发方式
- 推送 `v*` tag（如 `v1.0.0`）自动执行；
- 也支持在 Actions 页面手动 `workflow_dispatch`。

tag 由开发者本地按约定执行（脚本红线：不 push、不建 tag、不自动发布）：

```bash
git tag -s v1.0.0 -m "release 1.0.0"
git push origin v1.0.0
```

### 一个 job（仅发布）
1. **publish**：装依赖 → 直接 `pnpm --filter @x-ac/web-design-core/@x-ac/web-design-vue/@x-ac/web-design-react build`（不经过 release.mjs）→ `pnpm test` → `pnpm -r --filter "./packages/*" publish --access public --no-git-checks --provenance` 发布到 npmjs。**无需 NPM_TOKEN**：走 npm Trusted Publishing（OIDC），由 `id-token: write` 提供的临时凭证直接发布并生成 provenance。

### 示例演示站（独立工作流）
GitHub Pages 部署由独立的 `.github/workflows/pages.yml` 负责，与 npm 发布职责分离：
- 触发：推送 `main` 分支（且 `apps/`、`packages/`、锁文件或本工作流有改动）或手动 `workflow_dispatch`；
- 部署：构建 `apps/vue-example` → 站点根 `/`，`apps/react-example` → 站点子路径 `/react/`（其 vite `base` 已设为 `/react/`）；
- 前置：仓库 Settings → Pages → Source 选「GitHub Actions」。

### npm 溯源证明（Provenance）+ 无 Token 发布
发布命令带 `--provenance`，发布成功后 npm 包详情会显示 **「Built and signed with provenance」** 徽章，证明包确实从该仓库源码、在本次 Actions 运行中构建并发布。

**无 Token 发布（npm Trusted Publishing）**：本工作流不配置 `NPM_TOKEN`，GitHub Actions 用 OIDC 临时凭证直接向 npmjs 发布，凭证由 Actions 运行时注入，发布命令本身只多一个 `--provenance`。

前置条件：
- `permissions` 含 `id-token: write`（OIDC 凭证来源，已声明）；
- `runs-on: ubuntu-latest`（官方托管 runner，OIDC 仅官方 runner 可用）；
- publish job 用 `node-version: 24`（npm >= 11.5.1 才支持 OIDC；`setup-node` 不写 `registry-url`，避免 .npmrc 与 OIDC 冲突）；
- 三库在**同一次运行内**从源码构建后紧接着发布（不能是预发制品）；
- 每个包的 `package.json` 有 `repository` 字段（1.0.0 已补）。

**首包前提已满足**：npm 不允许可信发布接管从未存在过的包，但已先发占位包 + 配好三个包的 Trusted Publisher，因此 1.0.0 现在即可直接走 tokenless OIDC 发布，无需任何 token。若日后 OIDC 报 `ENEEDAUTH`，先核对 npmjs 的 Trusted Publisher 的 owner / repository / Workflow 文件名是否与本仓库及 `publish.yml` 完全一致。

**Trusted Publisher（已在 npmjs.com 配好，保留步骤备查）**：对每个包分别操作：
1. 打开 `https://www.npmjs.com/package/@x-ac/web-design-core/access`（core / vue / react 各一次）；
2. 找到 Publishing access → **Add a trusted publisher** → 选 **GitHub Actions**；
3. 填 `owner=cn-xac`、`repository=web-design`、`Workflow 文件名=publish.yml`、`Environment` 留空；
4. 保存。三个包各自注册一次（monorepo 每个包独立）。

### 需要的仓库 Secret / 设置
- **无 NPM_TOKEN 依赖**：本工作流完全走 OIDC，仓库 Secrets 里不需要任何 npm token。
- Pages：仓库 Settings → Pages → Source 选「GitHub Actions」；
- `id-token: write` 权限已写入工作流（见 `permissions`），这是 OIDC 发布的唯一权限前提；
- 三个包的 Trusted Publisher 已在 npmjs.com 注册（owner=cn-xac / repository=web-design / Workflow=publish.yml）。

### 决策记录
- 三包版本定为 **1.0.0**（核心渲染 / 设计器能力已具备，功能层与 Vue 版对齐）；每个 `package.json` 同时补了 `repository` / `homepage` / `bugs`，指向 `cn-xac/web-design`。
- **1.1.0**：`schemaVersion` 升到 `1.1.0`（`node.visibility` 显隐契约 + 迁移链 `1.0.0 → 1.1.0`），React 设计器补齐与 Vue 验收版对齐的六个弹窗与外部数据源入口，设计器「选元素」下拉补 `filterable` 透传。发布方式不变：推 `v1.1.0` tag 触发 `publish.yml` 走可信发布，无 NPM_TOKEN。
- 示例按目录拆成两个独立项目（`apps/vue-example` 与 `apps/react-example`），各自只依赖对应适配层 + core，**零 UI 库依赖**，CI 可直接构建，不再依赖 `playground` 的兄弟 EP 仓（`link:../../../design-vue-element-plus`）。
- 发布与示例部署分离：npm 发布只发 `packages/*` 三包，示例仅作 Pages 演示，不参与发版。
- 发布脚本 `scripts/release.mjs` 仍保留给本地用（`release:check` / `release:version` / `release:publish`），但 CI 不走它。
