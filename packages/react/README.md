# @x-ac/design-react

React 适配层：用同一份 `PageSchema` 渲染页面，内置表单校验与数据导出。

没有绑定任何 UI 库——默认映射到原生元素（input / select / table / button），所以只有 4 KB gzip；要换 antd / MUI，只改 `components.tsx` 一张表。

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

```tsx
import { COMPONENTS } from "@x-ac/design-react";
COMPONENTS.input = (props) => <Input {...props} />;
```

约束只有一条：**组件必须把 `style` 应用到根元素**，否则通用 margin / padding 失效。

## 与 Vue 版差异

| 项 | Vue | React |
|---|---|---|
| 双向绑定 | `modelValue` + `@update:modelValue` | `value` + `onChange` |
| 响应式 | `reactive(scope)` 自动重渲染 | 手动 `flush()`（core 的 `setByPath` 只改对象） |
| 设计器 | 有 | 暂无（复用 Vue 设计器或以 Web Component 挂载） |

## License

MIT
