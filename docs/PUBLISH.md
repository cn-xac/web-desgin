# 发布到 npm

三个包可以独立发布，也可以一次全发：

| 包 | 作用 | 依赖 |
|---|---|---|
| `@x-ac/design-core` | 框架无关内核（Schema / 表达式 / 校验 / 数据导出 / 静态 HTML） | 无运行时依赖 |
| `@x-ac/design-vue` | Vue 3 渲染器 + 设计器 + Element Plus 物料 | core，peer: vue / element-plus（pinia 仅设计器，可选） |
| `@x-ac/design-react` | React 渲染器（原生元素物料） | core，peer: react |

## 1. 包名与 scope

三个包已定为 `@x-ac/design-core` / `@x-ac/design-vue` / `@x-ac/design-react`（scope `@x-ac`，包名前缀 `design-`）。发布前先确认这个 scope 在你的账号或组织下：

```bash
npm login
npm whoami                        # 应能对应上 @x-ac 的归属账号 / 组织
npm access list packages @x-ac    # 可选：看该 scope 下已有包
```

以后再换名字，一条命令改全仓：

```bash
cd project
node scripts/rename-scope.mjs @your-scope                 # 只换 scope：@x-ac/design-core → @your-scope/design-core
node scripts/rename-scope.mjs @your-scope --prefix ui-    # 换 scope 同时换前缀：→ @your-scope/ui-core
pnpm install && pnpm build:lib && pnpm typecheck && pnpm test
```

脚本会改三个包的 `name`、互相依赖的 key，以及源码 / 配置（vite、vitest、tsconfig 的 alias）/ 文档里所有 import 与提及；重复执行不会产生变化。

如果不想用 scope，需要手工把三个 `package.json` 的 `name` 改成裸名（脚本只处理 scoped 名）。

## 2. 发布前自检

```bash
cd project
pnpm test          # 全部用例
pnpm typecheck     # 五个包类型检查
pnpm build:lib     # 构建 core / vue / react

# 检查 tarball 内容（不会真的发布）
pnpm --filter @x-ac/design-core pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-vue pack --pack-destination ../tmp/packs
pnpm --filter @x-ac/design-react pack --pack-destination ../tmp/packs
```

要确认的点：

- `files` 只包含 `dist`、`README.md`、`LICENSE`，没有源码和测试；
- `dist` 里没有上次构建残留的旧 chunk（构建前会跑 `scripts/clean-dist.mjs` 清空）；
- tarball 内 `package.json` 的 `dependencies` 里，`workspace:*` 已被替换成具体版本号（pnpm 自动完成）；
- `dist/index.d.ts`、`dist/designer.d.ts` 与 `exports` 声明的路径一一对应。

## 3. 发布

```bash
cd project
npm login                      # 或 pnpm login
pnpm -r publish --access public
```

顺序由 pnpm 按依赖拓扑自动决定（core → vue / react）。发布前会跑各包的 `prepack`，等于再构建一次。

只想发某一个：

```bash
pnpm --filter @x-ac/design-core publish --access public
```

## 4. 版本号

- 三个包**保持同一版本号**，便于使用者对齐；升级时一起改。
- 目前是 `0.x`，`0.x` 的次版本号可以破坏兼容；到 `1.0.0` 之后按 semver。
- 只改动一个包也可以单独发，但要在 CHANGELOG 里说明。

```bash
# 统一升版本（不改依赖范围，因为包之间是精确版本）
node -e "const fs=require('fs');for(const p of ['core','vue','react']){const f='packages/'+p+'/package.json';const d=JSON.parse(fs.readFileSync(f));d.version='0.3.1';fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n')}"
```

## 5. 发布后验证

在一个空目录里装 tarball 或线上包，跑一次真实渲染：

```bash
mkdir /tmp/check && cd /tmp/check
npm init -y && npm i @x-ac/design-core
node -e "import('@x-ac/design-core').then(m=>console.log(Object.keys(m).length))"
```

Vue / React 侧建议各跑一次 SSR 渲染（本项目发布前就是这么验的）：

```js
// Vue
const html = await renderToString(createSSRApp({ render: () => h(SchemaRenderer, { page }) }));
// React
const html = renderToStaticMarkup(createElement(SchemaRenderer, { page }));
```

## 6. 私有 registry

公司内网发布时，把 `publishConfig.registry` 改成内网地址，或在 `.npmrc` 里配：

```ini
@your-scope:registry=https://npm.internal.example.com/
//npm.internal.example.com/:_authToken=${NPM_TOKEN}
```

## 7. 常见坑

- **`workspace:*` 未改写**：只会在 `pnpm publish` / `pnpm pack` 时改写；直接 `npm publish` 会失败。
- **peer 版本过窄**：`element-plus: ^2.6.0`、`vue: ^3.4.0`、`react: ^18 || ^19`，升级主版本前先放宽范围。
- **样式丢失**：包内 CSS 通过 `exports["./style.css"]` 暴露，使用方需要显式 `import "@x-ac/design-vue/style.css"`。
- **设计器报缺 pinia**：pinia 是可选 peer，只有用设计器才需要安装。
- **撤回**：`npm unpublish @your-scope/core@0.3.0 --force` 仅在发布 72 小时内可用，之后只能发新版本。
