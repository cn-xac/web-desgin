<script setup lang="ts">
/**
 * 递归渲染器。入参只有 PageSchema，不依赖设计器任何模块。
 * mode=view 挂事件、跑动作；mode=edit 只做视觉呈现，供设计器包裹交互。
 */
import { computed, inject } from "vue";
import type { CSSProperties, Component } from "vue";
import type { NodeSchema } from "@x-ac/web-design-core";
import { DEFAULT_BINDING, camelizeEventName, createEventPayload, materialKey, runEventHooks } from "@x-ac/web-design-core";
import FieldShell from "./FieldShell.vue";
import SchemaSubForm from "./SchemaSubForm.vue";
import { extractPath, getByPath, isBindable, isRequired, resolveBoolean, resolveNodeStyle, resolveValue, setByPath } from "@x-ac/web-design-core";
import { BINDING_BASE, DESIGNER_SCENE, RENDER_CONTEXT, useUiAdapter } from "./context";
import { useMaterialCatalog } from "../materials/catalog";
import { runNodeActions } from "./runActions";

const props = withDefaults(
  defineProps<{
    node: NodeSchema;
    scope: Record<string, unknown>;
    mode?: "view" | "edit";
    design?: boolean;
    ignoreFor?: boolean;
  }>(),
  { mode: "view", design: false, ignoreFor: false },
);

const scene = inject(DESIGNER_SCENE, null);
const renderCtx = inject(RENDER_CONTEXT, null);
/** 当前 UI 适配包：组件实现、双向绑定通道、动作副作用都从这里取 */
const adapter = useUiAdapter();
const catalog = useMaterialCatalog();
/** 绑定前缀：默认 form；子表单内由上层 BindingScope 注入当前组路径，实现无限嵌套 */
const bindingBase = inject(BINDING_BASE, "form");

const material = computed(() => catalog.get(props.node.component));
// 引擎按 kind 结构渲染的物料（如子表单）没有 UI 库组件实现，不算未知
const isUnknown = computed(() => !material.value || (!resolved.value && material.value.kind !== "subform"));
const resolved = computed<Component | string | null>(() => {
  const key = materialKey(props.node.component);
  return (adapter?.components?.[key] as Component | string | undefined) ?? null;
});
const nodeLabel = computed(() => material.value?.title ?? props.node.component);

/* ---------------- 指令 ---------------- */

const forDirective = computed(() =>
  props.ignoreFor ? undefined : props.node.directives?.find((d) => d.name === "for"),
);

const loopInstances = computed<Array<{ key: string; scope: Record<string, unknown> }> | null>(() => {
  const directive = forDirective.value;
  if (!directive) return null;

  const raw = directive.value ?? "";
  const expression = raw.includes("{{") ? raw : `{{${raw}}}`;
  const list = resolveValue(expression, props.scope);
  const items = Array.isArray(list) ? list : [];
  const itemKey = directive.itemKey ?? "item";
  const indexKey = directive.indexKey ?? "index";

  return items.map((item, index) => ({
    key: `${props.node.id}-${index}`,
    scope: { ...props.scope, [itemKey]: item, [indexKey]: index } as Record<string, unknown>,
  }));
});

const hiddenByIf = computed(() =>
  (props.node.directives ?? []).some((d) => d.name === "if" && !resolveBoolean(d.value, props.scope)),
);

const hiddenByShow = computed(() =>
  (props.node.directives ?? []).some((d) => d.name === "show" && !resolveBoolean(d.value, props.scope)),
);

/* ---------------- 属性 ---------------- */

const effective = computed(() => catalog.defaults(props.node.component, props.node.props));

const bindProps = computed<Record<string, unknown>>(() => {
  const out: Record<string, unknown> = {};
  const materialMeta = material.value;
  const raw = effective.value;
  // 属性别名只作用于「要透传给组件的普通属性」：面板字段、绑定通道、事件名都不映射
  const aliases = adapter?.propAliases;

  for (const [key, value] of Object.entries(raw)) {
    // 面板/外壳专用字段，以及正文来自 textProp 的字段，都不透传给组件
    if (["label", "required", "tip", "block", "radius", "modelValue"].includes(key)) continue;
    if (materialMeta?.textProp === key) continue;
    if (materialMeta?.internalProps?.includes(key)) continue;
    // 表达式能力按 Schema 里的通用名判断，映射只改最终传给组件的属性名
    out[aliases?.[key] ?? key] = isBindable(key) ? resolveValue(value, props.scope) : value;
  }

  // 双向绑定：通道名由适配包决定（Element Plus 是 modelValue，antd / Naive 是 value）
  const channel = adapter?.binding ?? DEFAULT_BINDING;
  const modelValue = raw.modelValue;
  // 显式绑定优先；表单控件未设置 modelValue 时，按「绑定前缀.组件ID」自动推导，
  // 实现「按组件ID自动绑定」。前缀默认 form，子表单内为当前组路径（支持无限嵌套）。
  const explicitPath = extractPath(modelValue);
  const path = explicitPath ?? (materialMeta?.isFormControl ? `${bindingBase}.${props.node.id}` : null);
  if (path) {
    out[channel.prop] = getByPath(props.scope, path);
    out[channel.event] = (value: unknown) => {
      setByPath(props.scope, path, value);
      // 已经报错的字段边改边验：改对了立刻消红，没改对继续提示
      if (renderCtx?.errors[props.node.id]) renderCtx.validateField(props.node);
    };
  } else if (modelValue !== undefined) {
    out[channel.prop] = resolveValue(modelValue, props.scope);
  }

  return out;
});

const slotText = computed<string | null>(() => {
  const key = material.value?.textProp;
  if (!key) return null;
  const value = effective.value[key];
  if (value === undefined || value === null) return null;
  return String(resolveValue(value, props.scope) ?? "");
});

const fieldLabel = computed(() => String(effective.value.label ?? ""));
const fieldRequired = computed(() => isRequired(props.node, effective.value));
const fieldError = computed(() => renderCtx?.errors[props.node.id] ?? "");

const mergedStyle = computed<CSSProperties>(() => {
  // 通用间距（margin / padding）与其余样式走同一条链路：
  // 组件契约样式 → 物料默认样式 → 节点 style（含表达式求值）
  // 物料取自注入目录（适配包 + 业务物料），否则适配包的 defaultStyle 不生效
  const style = resolveNodeStyle(
    props.node.component,
    effective.value,
    props.node.style,
    (value) => resolveValue(value, props.scope),
    material.value,
  ) as CSSProperties;

  if (hiddenByShow.value) style.display = "none";
  // 穿透节点（如栅格列）在空内容时给最小高度，否则高度塌成 0 根本点不中 / 拖不进
  if (isPassthrough.value && !(props.node.children?.length) && !style.minHeight) {
    style.minHeight = "56px";
  }
  return style;
});

/* ---------------- 事件 ---------------- */

const eventHandlers = computed<Record<string, (...args: unknown[]) => void>>(() => {
  const out: Record<string, (...args: unknown[]) => void> = {};
  if (props.mode !== "view" || props.design || !renderCtx) return out;

  for (const [name, actions] of Object.entries(props.node.events ?? {})) {
    // v-on 对象绑定的 key 用事件名本身（Vue 内部会补 on 前缀并转驼峰），
    // 所以 row-click 要写成 rowClick，不能写 onClick。
    const handlerName = camelizeEventName(name);

    out[handlerName] = (...args: unknown[]) => {
      // 组件派发的原始参数不再丢弃：开发者可在钩子里读取 / 归一化，
      // 动作参数表达式也能通过 $event / $args / $value 引用。
      const payload = createEventPayload({
        name,
        handlerName,
        node: props.node,
        material: material.value ?? undefined,
        page: renderCtx.page,
        scope: props.scope,
        args,
        actions,
      });

      const shouldRun = runEventHooks(payload, [adapter?.onEvent, renderCtx.onEvent]);
      renderCtx.notifyEvent(payload);
      if (!shouldRun) return;

      void runNodeActions(
        actions,
        {
          scope: props.scope,
          page: renderCtx.page,
          errors: renderCtx.errors,
          resetScope: renderCtx.resetScope,
          navigate: renderCtx.navigate,
          onFormSubmit: renderCtx.onFormSubmit,
          event: payload,
        },
        adapter?.actions,
      );
    };
  }

  return out;
});

/**
 * 失焦校验。
 * 用原生 focusout 而不是组件的 blur：focusout 会冒泡，且不依赖各 UI 库是否派发 blur，
 * Element Plus / 原生控件 / 未来换库都能用同一条路径。
 */
function onFieldBlur(event: FocusEvent): void {
  if (!renderCtx || props.mode !== "view" || props.design) return;
  if (!material.value?.isFormControl) return;

  const wrapper = event.currentTarget as HTMLElement | null;
  const next = event.relatedTarget as Node | null;
  // 在同一个字段内部移动焦点（例如点到清除按钮）不算失焦
  if (wrapper && next && wrapper.contains(next)) return;

  renderCtx.validateField(props.node);
}

/* ---------------- 设计态包裹 ---------------- */

const wrapperClass = computed(() => ({
  "wb-node--design": props.design,
  "wb-node--passthrough": props.design && Boolean(material.value?.wrapperPassthrough),
  "is-selected": props.design && scene?.selectedId() === props.node.id,
  "is-hovered": props.design && scene?.hoveredId?.() === props.node.id,
  "is-hidden": hiddenByShow.value,
}));

/**
 * 包裹层穿透：设计态下让节点成为父级 flex/grid 的直系子项，
 * 否则 .wb-node--design 的 display:block 会打断 el-row > el-col 关系，
 * 导致列宽由内容撑开而非由 span 决定（栅格列「控制的是内容」这一原始 bug）。
 */
const isPassthrough = computed(() => props.design && Boolean(material.value?.wrapperPassthrough));
/** 选中 / 悬停框改画到组件根节点（包裹层已无盒子，无法承载 outline） */
const passthroughClass = computed(() =>
  isPassthrough.value
    ? {
        "is-selected": scene?.selectedId() === props.node.id,
        "is-hovered": scene?.hoveredId?.() === props.node.id,
      }
    : null,
);
/** 让组件根可拖拽：display:contents 的包裹层自身无法作为拖拽源 */
const passthroughDraggable = computed(() => (isPassthrough.value ? "true" : undefined));

/** 空容器在设计态给一块可点击的占位区，否则高度塌成 0 根本点不中 */
const showEmptyHint = computed(
  () => props.design && Boolean(material.value?.acceptsChildren) && !(props.node.children?.length),
);

const hint = computed(() => (props.design ? (scene?.hintFor(props.node.id) ?? null) : null));

function positionFromEvent(event: DragEvent): "inside" | "before" | "after" {
  const element = event.currentTarget as HTMLElement | null;
  if (!element) return "after";
  const rect = element.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);

  if (material.value?.acceptsChildren) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

function onDragStart(event: DragEvent): void {
  if (!props.design || !scene) return;
  event.stopPropagation();
  event.dataTransfer?.setData("text/plain", JSON.stringify({ kind: "move", id: props.node.id }));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  scene.onNodeDragStart(props.node.id);
}

function onDragOver(event: DragEvent): void {
  if (!props.design || !scene) return;
  event.preventDefault();
  event.stopPropagation();
  scene.onNodeDragOver({ id: props.node.id, position: positionFromEvent(event) });
}

function onDragLeave(event: DragEvent): void {
  if (!props.design || !scene) return;
  event.stopPropagation();
  scene.onNodeDragLeave(props.node.id);
}

function onDrop(event: DragEvent): void {
  if (!props.design || !scene) return;
  event.preventDefault();
  event.stopPropagation();
  scene.onNodeDrop({ id: props.node.id, position: positionFromEvent(event) });
}

function selectSelf(): void {
  if (!props.design || !scene) return;
  scene.select(props.node.id);
}
</script>

<template>
  <!-- for 指令：先展开成多个实例，再逐个渲染（子实例带 ignoreFor 防止递归展开） -->
  <template v-if="loopInstances">
    <SchemaNode
      v-for="instance in loopInstances"
      :key="instance.key"
      :node="node"
      :scope="instance.scope"
      :mode="mode"
      :design="design"
      ignore-for
    />
  </template>

  <div
    v-else-if="!hiddenByIf"
    class="wb-node"
    :class="wrapperClass"
    :data-node-id="design ? node.id : undefined"
    :data-node-label="design ? nodeLabel : undefined"
    :draggable="design ? 'true' : undefined"
    @click.stop="selectSelf"
    @focusout="onFieldBlur"
    @dragstart.stop="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <template v-if="design && !isPassthrough">
      <span class="wb-node__tag">{{ nodeLabel }}</span>
      <span v-if="hint === 'before'" class="wb-drop wb-drop--before" />
      <span v-if="hint === 'after'" class="wb-drop wb-drop--after" />
      <span v-if="hint === 'inside'" class="wb-drop wb-drop--inside" />
    </template>

    <!-- 空容器占位：设计态可点选、可拖入；view 模式不渲染 -->
    <div v-if="showEmptyHint && !isPassthrough" class="wb-node__empty">空容器 · 点击选中，或把组件拖进来</div>

    <!-- 未知组件：降级为占位块，保留子节点，绝不白屏 -->
    <div v-else-if="isUnknown" class="wb-node__unknown">
      <div class="wb-node__unknown-title">未知组件 {{ node.component }}</div>
      <div class="wb-node__unknown-tip">物料未注册，已降级渲染；节点与子节点数据保留</div>
      <SchemaNode
        v-for="child in node.children ?? []"
        :key="child.id"
        :node="child"
        :scope="scope"
        :mode="mode"
        :design="design"
      />
    </div>

    <!-- 子表单（明细数组容器）：引擎按 kind 结构渲染，无需 UI 库组件实现 -->
    <SchemaSubForm
      v-else-if="material?.kind === 'subform'"
      :node="node"
      :scope="scope"
      :mode="mode"
      :design="design"
    />

    <!-- 表单控件：套一层字段外壳，负责标签、必填星号、错误文案；间距作用在外壳上 -->
    <FieldShell
      v-else-if="material?.kind === 'field'"
      :label="fieldLabel"
      :required="fieldRequired"
      :error="fieldError"
      :style="mergedStyle"
    >
      <component :is="resolved" v-bind="bindProps" v-on="eventHandlers" />
    </FieldShell>

    <component
      :is="resolved"
      v-else
      v-bind="bindProps"
      v-on="eventHandlers"
      :class="passthroughClass"
      :draggable="passthroughDraggable"
      :style="mergedStyle"
    >
      <template v-if="slotText !== null">{{ slotText }}</template>
      <template v-if="material?.acceptsChildren">
        <SchemaNode
          v-for="child in node.children ?? []"
          :key="child.id"
          :node="child"
          :scope="scope"
          :mode="mode"
          :design="design"
        />
      </template>
    </component>
  </div>
</template>

<style scoped>
.wb-node {
  display: contents;
}
.wb-node.is-hidden {
  display: none;
}
.wb-node--design {
  display: block;
  position: relative;
  outline: 1px dashed transparent;
  outline-offset: 2px;
  border-radius: 4px;
  transition: outline-color 0.12s ease;
}
.wb-node--design:hover {
  outline-color: #b9c6ff;
}
.wb-node--design.is-hovered {
  outline-color: #b9c6ff;
}
.wb-node--design.is-selected {
  outline: 2px solid var(--wb-primary);
}
/* 穿透节点：设计态包裹层不产生盒子，让 el-col / Col 回到 el-row / Row 的直系 flex 子项 */
.wb-node--design.wb-node--passthrough {
  display: contents;
  position: static;
}
/* 选中 / 悬停框改画到组件根节点（包裹层已无盒子，无法承载 outline） */
.wb-node--passthrough .is-selected {
  outline: 2px solid var(--wb-primary);
  outline-offset: 2px;
}
.wb-node--passthrough .is-hovered {
  outline: 1px dashed #b9c6ff;
  outline-offset: 2px;
}
.wb-node__empty {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--wb-line);
  border-radius: 6px;
  background: repeating-linear-gradient(-45deg, transparent 0 8px, rgba(47, 75, 255, 0.03) 8px 16px);
  font-size: 12px;
  color: var(--wb-ink3);
  pointer-events: none;
}
.wb-node__tag {
  position: absolute;
  top: -18px;
  left: -2px;
  z-index: 6;
  display: none;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--wb-primary);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
}
.wb-node--design.is-selected > .wb-node__tag,
.wb-node--design:hover > .wb-node__tag {
  display: block;
}
.wb-drop {
  position: absolute;
  z-index: 7;
  background: var(--wb-primary);
  pointer-events: none;
}
.wb-drop--before {
  left: 0;
  right: 0;
  top: -2px;
  height: 3px;
  border-radius: 2px;
}
.wb-drop--after {
  left: 0;
  right: 0;
  bottom: -2px;
  height: 3px;
  border-radius: 2px;
}
.wb-drop--inside {
  inset: 0;
  background: rgba(47, 75, 255, 0.08);
  border: 1px dashed var(--wb-primary);
  border-radius: 4px;
}
.wb-node__unknown {
  padding: 12px 14px;
  border: 1px dashed var(--wb-danger);
  border-radius: 6px;
  background: #fff5f5;
}
.wb-node__unknown-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-danger);
}
.wb-node__unknown-tip {
  margin-top: 2px;
  font-size: 12px;
  color: var(--wb-ink3);
}
</style>
