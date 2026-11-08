import { Fragment, createElement } from "react";
import type { ReactNode } from "react";
import {
  ACTION_REGISTRY,
  DEFAULT_BINDING,
  createEventPayload,
  extractPath,
  getByPath,
  isBindable,
  isRequired,
  materialKey,
  resolveBoolean,
  resolveNodeStyle,
  resolveValue,
  runActions,
  runEventHooks,
  toReactHandlerName,
} from "@x-ac/design-core";
import type { NodeSchema } from "@x-ac/design-core";
import type { CSSProperties } from "react";
import { RenderContext, useRenderContext } from "./context";
import type { RenderContextValue } from "./context";

const SKIP_PROPS = new Set(["label", "required", "tip", "block", "radius", "modelValue"]);

function FieldShell({
  label,
  required,
  error,
  style,
  children,
}: {
  label: string;
  required: boolean;
  error: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`ux-field${error ? " is-error" : ""}`} style={style}>
      {label ? (
        <span className="ux-field__label">
          {label}
          {required ? <i className="ux-req">*</i> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="ux-field__error">{error}</span> : null}
    </div>
  );
}

function NodeBody({ node }: { node: NodeSchema }) {
  const ctx = useRenderContext();
  // 物料元数据来自当前适配包（含业务物料），不是 core 的全局清单
  const material = ctx.catalog.get(node.component);
  const effective = ctx.catalog.defaults(node.component, node.props);

  const style = resolveNodeStyle(
    node.component,
    effective,
    node.style,
    (value) => resolveValue(value, ctx.scope),
    material,
  ) as CSSProperties;

  const hidden = (node.directives ?? []).some((d) => d.name === "show" && !resolveBoolean(d.value, ctx.scope));
  if (hidden) style.display = "none";

  if (!material) {
    return (
      <div className="ux-unknown" style={style} data-component={node.component}>
        <div className="ux-unknown__title">未知组件 {node.component}</div>
        <div className="ux-unknown__tip">物料未注册，已降级渲染；节点与子节点数据保留</div>
        {(node.children ?? []).map((child) => (
          <SchemaNode key={child.id} node={child} />
        ))}
      </div>
    );
  }

  /* 组件实现同样来自适配包：业务物料用 registerMaterials() 注册后就能命中 */
  const Component = ctx.ui.components[materialKey(node.component)] ?? null;

  /* 属性绑定：剔除面板专用字段与表达式求值 */
  const bound: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(effective)) {
    if (SKIP_PROPS.has(key)) continue;
    if (material.textProp === key) continue;
    if (material.internalProps?.includes(key)) continue;
    bound[key] = isBindable(key) ? resolveValue(value, ctx.scope) : value;
  }

  /**
   * 事件泛化：Schema 里写任意事件名都挂得上（row-click → onRowClick），
   * 组件派发的原始参数完整交给开发者钩子与动作系统，不再被吞掉。
   */
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  if (ctx.mode === "view") {
    for (const [name, actions] of Object.entries(node.events ?? {})) {
      const handlerName = toReactHandlerName(name);
      handlers[handlerName] = (...args: unknown[]) => {
        const payload = createEventPayload({
          name,
          handlerName,
          node,
          material: material ?? undefined,
          page: ctx.page,
          scope: ctx.scope,
          args,
          actions,
        });
        const shouldRun = runEventHooks(payload, [ctx.ui.onEvent, ctx.onEvent]);
        if (!shouldRun) return;

        void runActions(actions, {
          scope: ctx.scope,
          page: ctx.page,
          errors: ctx.errors,
          resetScope: ctx.resetScope,
          navigate: ctx.navigate,
          adapter: ctx.adapter,
          onFormSubmit: ctx.onFormSubmit,
          event: payload,
        }).then(() => ctx.flush());
      };
    }
  }

  /* 双向绑定：通道名由适配包决定（React 缺省 value/onChange） */
  const channel = ctx.ui.binding ?? DEFAULT_BINDING;
  const path = extractPath(effective.modelValue);
  if (path) bound[channel.prop] = getByPath(ctx.scope, path);
  else if (effective.modelValue !== undefined) bound[channel.prop] = resolveValue(effective.modelValue, ctx.scope);

  if (material.isFormControl) {
    // Schema 的 events.change 与受控通道共用 onChange：先写回状态，再派发动作
    const changePreset = handlers[channel.event];
    handlers[channel.event] = (...args: unknown[]) => {
      if (path) ctx.setValue(path, args[0], node.id);
      changePreset?.(...args);
    };
    // 失焦即校验：与 Vue 版行为对齐
    const blurPreset = handlers.onBlur;
    handlers.onBlur = (...args: unknown[]) => {
      if (ctx.mode === "view") ctx.validateField(node);
      blurPreset?.(...args);
    };
  }

  /* 正文：textProp 优先，其次是子节点 */
  const text = material.textProp ? resolveValue(effective[material.textProp], ctx.scope) : undefined;
  const children: ReactNode =
    text !== undefined && text !== null
      ? String(text)
      : (node.children ?? []).map((child) => <SchemaNode key={child.id} node={child} />);

  const control = Component ? (
    createElement(Component, { ...bound, ...handlers, key: node.id }, children)
  ) : (
    <div className="ux-unknown" data-component={node.component}>
      未映射的物料 {node.component}
    </div>
  );

  if (material.kind === "field") {
    return (
      <FieldShell
        label={String(resolveValue(effective.label ?? "", ctx.scope) ?? "")}
        required={isRequired(node, effective)}
        error={ctx.errors[node.id] ?? ""}
        style={style}
      >
        {control}
      </FieldShell>
    );
  }

  // 非表单组件把样式挂在自身；display 为 none 时同样生效
  return <Fragment>{createElement(Component ?? "div", { ...bound, ...handlers, style }, children)}</Fragment>;
}

/** 递归渲染入口：先处理 if / for，再渲染节点本体 */
export function SchemaNode({ node }: { node: NodeSchema }) {
  const ctx = useRenderContext();
  const directives = node.directives ?? [];

  if (directives.some((d) => d.name === "if" && !resolveBoolean(d.value, ctx.scope))) return null;

  const loop = directives.find((d) => d.name === "for");
  if (!loop) return <NodeBody node={node} />;

  const list = resolveValue(loop.value ?? "", ctx.scope);
  const items = Array.isArray(list) ? list : [];
  const itemKey = loop.itemKey ?? "item";
  const indexKey = loop.indexKey ?? "index";
  const rest: RenderContextValue = { ...ctx };

  return (
    <>
      {items.map((item, index) => (
        <RenderContext.Provider
          key={`${node.id}-${index}`}
          value={{ ...rest, scope: { ...ctx.scope, [itemKey]: item, [indexKey]: index } }}
        >
          <NodeBody node={{ ...node, directives: directives.filter((d) => d.name !== "for") }} />
        </RenderContext.Provider>
      ))}
    </>
  );
}

/** 供宿主判断某动作是否注册过（例如做按钮可用性提示） */
export function isActionRegistered(name: string): boolean {
  return Boolean(ACTION_REGISTRY[name]);
}
