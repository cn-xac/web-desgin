# @x-ac/design-core

框架无关的可视化搭建内核。**不依赖 Vue / React / Element Plus，也不访问 window**，可以在浏览器、Node、SSR、单测里同样运行。

同一份 `PageSchema` 交给 `@x-ac/design-vue` 或 `@x-ac/design-react` 渲染，结果一致；数据校验与导出也只在这里实现一次。

## 安装

```bash
pnpm add @x-ac/design-core
```

## PageSchema 速览

```ts
import type { PageSchema } from "@x-ac/design-core";

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "page_employee",
  type: "page",
  meta: { title: "员工登记", device: "pc" },
  state: { form: { name: "", mobile: "" } },
  children: [
    {
      id: "n_name",
      component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }, { type: "maxLength", value: 20 }],
    },
    {
      id: "n_mobile",
      component: "input",
      props: { label: "手机号", modelValue: "{{form.mobile}}" },
      rules: [{ type: "required" }, { type: "phone" }],
    },
  ],
};
```

## 校验规则

规则挂在节点上（`node.rules`），是纯数据，JSON 里不出现任何可执行代码。

| type | 说明 | value |
|---|---|---|
| `required` | 必填（空串 / 空白 / 空数组都算空） | 无 |
| `minLength` / `maxLength` | 最短 / 最长字符数，emoji 按码点算 | 数字 |
| `min` / `max` | 数值范围 | 数字 |
| `pattern` | 自定义正则，`flags` 支持 `imsu` | 正则源码 |
| `email` / `phone` | 内置格式（手机号为中国大陆 11 位） | 无 |
| `integer` | 必须为整数 | 无 |

通用字段：`message` 自定义文案（支持 `{label}` / `{value}` 占位）、`when` 条件表达式。

```ts
// 只有「企业类型」才要求填公司名称
{ type: "required", when: "form.type === 'company'" }
```

## API

```ts
import {
  validateData,        // 整页校验
  validateNodeField,   // 单字段校验（失焦用）
  describeField,       // 把一个节点描述成可校验字段
  exportData,          // 收集表单数据 + 校验
  toDataJSON,          // 序列化成 JSON 文本
  toHtml,              // 导出静态 HTML
} from "@x-ac/design-core";

// 1. 校验
const errors: Record<string, string> = {};   // nodeId -> 文案
const result = validateData(page, scope, { errors });
// { valid, errors: [{ nodeId, path, label, rule, message }], byNode, checkedFields, checkedRules }

// 2. 导出数据
const data = exportData(page, scope);
// { valid, data: { form: {...} }, flat: { "form.name": "..." }, fields, unbound, errors, exportedAt }
console.log(toDataJSON(data, { includeMeta: true }));
```

`exportData` 默认不导出空值（`includeEmpty: true` 可保留），并按绑定路径还原嵌套结构；`flat` 是同一份数据的扁平视图，方便直接丢给接口或表格。

## 其他能力

- `expression.ts`：自研 tokenizer + Pratt parser，禁用 `eval`、函数调用与原型链逃逸
- `tree.ts`：节点增删改移、面包屑、按新 id 克隆
- `style/`：通用 margin / padding（四边相等收敛成简写）+ 组件契约样式
- `actions/`：8 个声明式动作，副作用通过 `ActionAdapter` 注入
- `serialize.ts`：默认值不落库的压缩序列化

## License

MIT
