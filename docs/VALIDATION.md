# 数据校验与数据导出

本项目的校验分两层，名字相近但职责不同，改代码前先分清：

| | 校验对象 | 入口 | 失败后果 |
|---|---|---|---|
| **结构校验** | PageSchema 本身（能不能渲染） | `validatePage` / `assertValidPage` | 阻断保存 / 导入，提示到 Schema 路径 |
| **数据校验** | 用户填写的值（能不能提交） | `validateData` / `validateFieldValue` | 字段下方红字，不阻断渲染 |

本文只讲第二层。

## 1. 规则存在哪

规则挂在节点上：

```json
{
  "id": "n_name",
  "component": "input",
  "props": { "label": "姓名", "modelValue": "{{form.name}}" },
  "rules": [
    { "type": "required" },
    { "type": "maxLength", "value": 20 },
    { "type": "pattern", "value": "^[\\u4e00-\\u9fa5]{2,10}$", "message": "{label}只能是 2-10 个汉字" }
  ]
}
```

刻意**不放在 `props` 里**：

- 校验描述的是数据契约，换控件（input → select）规则不该变；
- props 会透传给 UI 组件，规则混进去会污染 DOM 属性；
- 未来 React / 小程序 / 服务端校验都读同一个 `rules`。

旧 Schema 的 `props.required: true` 仍然生效（等价于一条 `required`），设计器第一次编辑规则时会把它归一掉。

## 2. 规则类型

| `type` | 语义 | `value` | 备注 |
|---|---|---|---|
| `required` | 必填 | — | `""` / 纯空白 / `[]` / `null` 都算空；`0` 与 `false` 不算空 |
| `minLength` | 最短长度 | 数字 | 按码点计，emoji 算 1；数组按元素个数 |
| `maxLength` | 最长长度 | 数字 | 同上 |
| `min` | 最小值 | 数字 | 可转数字的字符串也参与比较 |
| `max` | 最大值 | 数字 | 同上 |
| `pattern` | 自定义正则 | 正则源码 | 另可给 `flags`（`imsu`），**不带首尾斜杠** |
| `email` | 邮箱 | — | `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` |
| `phone` | 手机号 | — | 中国大陆 11 位 |
| `integer` | 整数 | — | 数字或可转数字的字符串 |

通用字段：

- `message`：自定义文案，支持 `{label}`（字段标签）与 `{value}`（规则值）占位；
- `when`：条件表达式，为假时整条规则跳过。

```json
{ "type": "required", "when": "form.type === 'company'" }
```

### 空值语义

只有 `required` 会拦空值；其余规则遇到空值**直接跳过**。否则一个空输入会同时报「请填写」和「格式不正确」，体验很差。

### 一个字段只报一条

按 `rules` 顺序取第一条不通过的规则，避免红字堆叠。

## 3. 运行时 API

```ts
import { validateData, validateNodeField, describeField, valueLength } from "@x-ac/web-design-core";

// 整页
const errors: Record<string, string> = {};      // nodeId -> 文案，可直接给渲染器
const result = validateData(page, scope, { errors });
// result.valid / result.errors[{ nodeId, path, label, rule, message }] / result.byNode

// 单字段（失焦用）
validateNodeField(node, scope, errors);
```

`validateData` 传入 `errors` 时会**就地清理**上一轮已修好的键，不会残留「改好了还红着」。

### Vue

```ts
const renderer = ref<InstanceType<typeof SchemaRenderer> | null>(null);

renderer.value?.validate();          // boolean，错误自动显示
renderer.value?.getData();           // { data, flat, fields, errors, valid }
renderer.value?.getErrors();         // { nodeId: message }
renderer.value?.reset();             // 恢复 state 初值
```

字段失焦（原生 `focusout`）自动单字段校验；已报错的字段边改边验。

用 `focusout` 而不是组件的 `blur`：`focusout` 会冒泡，不依赖 Element Plus / 其他 UI 库是否派发 `blur`。

### React

```tsx
const ref = useRef<SchemaRendererHandle>(null);
<SchemaRenderer ref={ref} page={page} />;

ref.current?.validate();
ref.current?.getData();
```

## 4. 数据导出

```ts
import { exportData, toDataJSON } from "@x-ac/web-design-core";

const result = exportData(page, scope);
// {
//   valid, data: { form: { name: "张三" } },   // 按绑定路径还原嵌套
//   flat: { "form.name": "张三" },             // 扁平视图，丢给接口/表格
//   fields: [{ nodeId, path, label, component, value }],
//   unbound: [{ nodeId, label }],              // 没绑 modelValue 的字段
//   errors, exportedAt
// }

toDataJSON(result);                             // 只输出 data
toDataJSON(result, { includeMeta: true });      // 带 valid / errors / exportedAt
```

选项：

- `includeEmpty`（默认 `false`）：空值不写进 `data`，避免脏数据；`flat` 始终保留全量，便于排查；
- `validate`（默认 `true`）：导出时顺带校验；`false` 适合「先存草稿」。

与页面导出的区别：`toHtml` 导的是「页面长什么样」，`exportData` 导的是「用户填了什么」。

## 5. 设计器面板

选中表单控件 → 右侧「校验」标签页：

- 顶部开关控制必填；
- 「添加规则」按组件类型过滤（数字类不给长度规则，文本类不给数值规则）；
- 正则实时试编译，编译失败会标红（同时 `validatePage` 也会报 schema error）；
- 每条规则下方显示默认文案预览，与运行时同源（`ruleMessage`）；
- 所有改动进撤销栈。

## 6. 扩展一条新规则

三处，缺一不可：

1. `packages/core/src/validation/rules.ts`：`RuleType` 加类型、`RULE_DEFINITIONS` 加定义、`defaultRuleMessage` 加文案；
2. `packages/core/src/validation/engine.ts`：在 `checkRule` 的 `switch` 里实现判断；
3. `packages/core/src/schema/validator.ts`：如果规则需要特殊配置（如正则可编译），补结构校验。

设计器不用改：面板按 `RULE_DEFINITIONS` 的 `valueKind` 自动渲染输入控件。

## 7. 已知边界

- `pattern` 不防灾难性回溯（如 `(a+)+$`）。设计器只校验能否编译，不做复杂度分析；面向内部配置场景可接受，对外开放表单配置时建议加长度上限。
- 规则只作用于表单控件（`isFormControl`），普通展示组件不参与。
- 导出只按 `modelValue` 的绑定路径收集；未绑定字段会进 `unbound` 而不是被塞进结果。
- 不支持跨字段比较（如「确认密码」）。扩展方式是加一条 `type: "custom"` + `when` 组合，或在宿主侧二次校验。
