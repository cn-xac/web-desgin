import { Fragment, createElement } from "react";
import type { DragEvent, FocusEvent, ReactNode } from "react";
import type { DropPosition } from "@x-ac/design-core";
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

/** 与 Vue 的 positionFromEvent 同一套阈值：容器上下 1/4 为 before/after，中间 inside */
function positionFromEvent(event: DragEvent<HTMLDivElement>, acceptsChildren: boolean): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / (rect.height || 1);
  if (acceptsChildren) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

/**
 * 设计态节点外壳（对齐 Vue 的 div.wb-node）。
 * 只在 design=true 时包一层 DOM；运行时走原路径，不改变任何布局。
 */
function DesignerWrap({ node, children }: { node: NodeSchema; children: ReactNode }) {
  const ctx = useRenderContext();
  const scene = ctx.designer;
  if (!ctx.design || !scene) return <>{children}</>;

  const material = ctx.catalog.get(node.component);
  const accepts = Boolean(material?.acceptsChildren);
  const hint = scene.hintFor(node.id);
  const className = [
    "ux-node",
    "ux-node--design",
    scene.selectedId() === node.id ? "is-selected" : "",
    scene.hoveredId() === node.id ? "is-hovered" : "",
    hint ? `is-hint-${hint}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-node-id={node.id}
      data-node-label={material?.title ?? node.component}
      draggable
      onClick={(event) => {
        event.stopPropagation();
        scene.select(node.id);
      }}
      onMouseEnter={(event) => {
        event.stopPropagation();
        scene.hoverNode(node.id);
      }}
      onMouseLeave={(event) => {
        event.stopPropagation();
        scene.hoverNode(null);
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "move", id: node.id }));
        event.dataTransfer.effectAllowed = "move";
        scene.onNodeDragStart(node.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        scene.onNodeDragOver({ id: node.id, position: positionFromEvent(event, accepts) });
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        scene.onNodeDragLeave(node.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        scene.onNodeDrop({ id: node.id, position: positionFromEvent(event, accepts) });
      }}
    >
      <span className="ux-node__tag">{material?.title ?? node.component}</span>
      {hint ? <span className={`ux-drop ux-drop--${hint}`} /> : null}
      {accepts && !node.children?.length ? (
        <div className="ux-node__empty">空容器 · 点击选中，或把组件拖进来</div>
      ) : null}
      {children}
    </div>
  );
}

function FieldShell({
  label,
  required,
  error,
  style,
  onBlur,
  children,
}: {
  label: string;
  required: boolean;
  error: string;
  style: CSSProperties;
  /** React 的 onBlur 由 focusout 模拟，会冒泡，不依赖具体 UI 库派发 blur */
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  return (
    <div className={`ux-field${error ? " is-error" : ""}`} style={style} onBlur={onBlur}>
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

  /* 属性绑定：剔除面板专用字段、按适配包别名改名、表达式求值 */
  const bound: Record<string, unknown> = {};
  const aliases = ctx.ui.propAliases;
  for (const [key, value] of Object.entries(effective)) {
    if (SKIP_PROPS.has(key)) continue;
    if (material.textProp === key) continue;
    if (material.internalProps?.includes(key)) continue;
    // 别名只改最终传给组件的属性名；绑定通道与事件名由 channel / handlers 单独决定
    bound[aliases?.[key] ?? key] = isBindable(key) ? resolveValue(value, ctx.scope) : value;
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
        // 只读通知在钩子之后、控制流判断之前，与 Vue 的 renderCtx.notifyEvent 顺序一致：
        // 即使被 preventDefault 阻断，宿主仍能观察到这次事件。
        ctx.notifyEvent(payload);
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
    // 失焦校验改由 FieldShell 的 onBlur（focusout 冒泡）承担，与 Vue 版一致：
    // 不依赖各 UI 库是否转发 onBlur，组件自带的 events.blur 动作也照常派发。
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
        onBlur={(event) => {
          if (ctx.mode !== "view" || ctx.design || !material.isFormControl) return;
          const wrapper = event.currentTarget;
          const next = event.relatedTarget as Node | null;
          // 同一字段内部移动焦点（例如点到清除按钮）不算失焦
          if (next && wrapper.contains(next)) return;
          ctx.validateField(node);
        }}
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
  if (!loop)
    return (
      <DesignerWrap node={node}>
        <NodeBody node={node} />
      </DesignerWrap>
    );

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
          <DesignerWrap node={node}>
            <NodeBody node={{ ...node, directives: directives.filter((d) => d.name !== "for") }} />
          </DesignerWrap>
        </RenderContext.Provider>
      ))}
    </>
  );
}

/** 供宿主判断某动作是否注册过（例如做按钮可用性提示） */
export function isActionRegistered(name: string): boolean {
  return Boolean(ACTION_REGISTRY[name]);
}
