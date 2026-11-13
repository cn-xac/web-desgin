/**
 * 属性面板：按物料字段分组编辑当前选中节点的 props。
 * 与 Vue 版 PropsEditor.vue 功能对齐，差异只在 React 的受控通道 value / onChange。
 */
import { createElement, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { FIELD_GROUP_LABELS, collectBindableData, fieldOptions, groupFields } from "@x-ac/web-design-core";
import type { PropField, PropFieldGroup } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

/** 列定义的统一编辑模型：title 是列标题，key 是取数字段名 */
interface ColumnItem {
  title: string;
  key: string;
}

/** 分组折叠初值：高级属性默认收起 */
const INITIAL_COLLAPSED: Record<PropFieldGroup, boolean> = {
  basic: false,
  content: false,
  data: false,
  style: false,
  advanced: true,
};

/**
 * 列定义读入：数组兼容 {title,key} 与 {label,prop} 两种命名，
 * 字符串按「标签:字段名」成对拆分，与 core 的 parseColumns 保持同一套语义。
 */
function columnsOf(raw: unknown): ColumnItem[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        title: String(record.title ?? record.label ?? ""),
        key: String(record.key ?? record.prop ?? ""),
      };
    });
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [title, key] = pair.split(":").map((part) => part.trim());
        return { title: title || key || "", key: key || title || "" };
      });
  }
  return [];
}

export function PropsEditor() {
  const { store, state, adapter, registry, notify } = useDesigner();
  const [collapsed, setCollapsed] = useState<Record<PropFieldGroup, boolean>>(INITIAL_COLLAPSED);

  const node = state.selectedNode;
  const material = node ? registry.get(node.component) : undefined;

  // hooks 全部先调用，再做空态兜底，保证 hooks 顺序稳定
  if (!node || !material) {
    return (
      <div className="props">
        <div className="props__empty">请先在画布中选中一个组件</div>
      </div>
    );
  }

  const nodeId = node.id;
  // 有效属性 = 物料默认值 + 节点自身属性（默认值不落库）
  const effective = registry.defaults(node.component, node.props);
  const customKeys = new Set(Object.keys(node.props ?? {}));
  const sections = groupFields(material.fields);

  /**
   * 可绑定数据清单（ruUqAF）：由 core 从页面 Schema 生成，与 Vue 侧同一份实现。
   * React 侧没有弹窗基建，这里用原生下拉直接选，改动最小且功能等价。
   */
  const bindables = useMemo(
    () => collectBindableData(state.page, { registry }),
    [state.page, registry],
  );

  const value = (key: string): unknown => effective[key];
  const isCustom = (key: string): boolean => customKeys.has(key);
  const isBound = (input: unknown): boolean => typeof input === "string" && input.includes("{{");
  const set = (key: string, next: unknown): void => store.updateProp(key, next);

  /** 适配包字段编辑器覆盖：columns 由引擎内置结构化编辑器接管，不走覆盖 */
  const editorFor = (field: PropField): ComponentType<any> | null => {
    if (field.type === "columns") return null;
    const custom = adapter?.editors?.[field.type];
    return (custom as ComponentType<any> | undefined) ?? null;
  };

  const copyId = (): void => {
    void navigator.clipboard?.writeText(nodeId);
    notify("已复制节点 ID", "success");
  };

  const toggle = (group: PropFieldGroup): void => {
    setCollapsed((prev) => {
      const next = { ...prev };
      next[group] = !prev[group];
      return next;
    });
  };

  /** 绑定选择：选一个可绑定数据，写成 {{path}}（覆盖当前值） */
  const applyBinding = (key: string, path: string): void => {
    if (!path) return;
    set(key, `{{${path}}}`);
  };

  /**
   * 写回列定义：沿用输入数据原有的命名（label/prop 或 title/key），
   * 既兼容适配包的 title/key 列，也不破坏只读 label/prop 的渲染器。
   */
  const writeColumns = (fieldKey: string, next: ColumnItem[]): void => {
    const raw = value(fieldKey);
    const useTitleKey =
      Array.isArray(raw) &&
      raw.some((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return "title" in record || "key" in record;
      });
    const serialized = next.map((column) =>
      useTitleKey
        ? { title: column.title, key: column.key }
        : { label: column.title, prop: column.key },
    );
    set(fieldKey, serialized);
  };

  const updateColumn = (fieldKey: string, index: number, field: "title" | "key", next: string): void => {
    const list = columnsOf(value(fieldKey)).slice();
    const column = list[index];
    list[index] = field === "title" ? { ...column, title: next } : { ...column, key: next };
    writeColumns(fieldKey, list);
  };

  const addColumn = (fieldKey: string): void => {
    const list = columnsOf(value(fieldKey));
    writeColumns(fieldKey, [...list, { title: "新列", key: `field${list.length + 1}` }]);
  };

  const removeColumn = (fieldKey: string, index: number): void => {
    const list = columnsOf(value(fieldKey)).slice();
    list.splice(index, 1);
    writeColumns(fieldKey, list);
  };

  const renderColumns = (field: PropField): ReactNode => {
    const list = columnsOf(value(field.key));
    return (
      <div className="columns">
        {list.map((column, index) => (
          <div className="columns__row" key={index}>
            <UiControl
              as="Input"
              size="small"
              value={column.title}
              placeholder="列名"
              onChange={(v: unknown) => updateColumn(field.key, index, "title", String(v))}
            />
            <UiControl
              as="Input"
              size="small"
              value={column.key}
              placeholder="字段"
              onChange={(v: unknown) => updateColumn(field.key, index, "key", String(v))}
            />
            <button
              type="button"
              className="columns__del"
              title="删除该列"
              onClick={() => removeColumn(field.key, index)}
            >
              ×
            </button>
          </div>
        ))}
        <UiControl as="Button" size="small" type="primary" onClick={() => addColumn(field.key)}>
          + 添加列
        </UiControl>
      </div>
    );
  };

  /** 单个字段的控件：适配包覆盖优先，否则按 field.type 走内置实现 */
  const renderControl = (field: PropField): ReactNode => {
    const current = value(field.key);
    const custom = editorFor(field);
    if (custom) {
      return createElement(custom as ComponentType<any>, {
        value: current,
        field,
        onChange: (v: unknown) => set(field.key, v),
      });
    }

    switch (field.type) {
      case "boolean":
        return (
          <UiControl
            as="Switch"
            size="small"
            value={Boolean(current)}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      case "number":
        return (
          <UiControl
            as="NumberInput"
            size="small"
            controls={false}
            value={Number(current ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v: unknown) => set(field.key, Number(v ?? 0))}
          />
        );
      case "select":
        return (
          <UiControl
            as="Select"
            size="small"
            value={current}
            options={fieldOptions(field)}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      case "color":
        return (
          <UiControl
            as="ColorInput"
            size="small"
            value={String(current ?? "")}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      // textarea 与 options 都用多行输入：选项是逗号/换行分隔的列表
      case "textarea":
      case "options":
        return (
          <UiControl
            as="Input"
            size="small"
            rows={3}
            value={String(current ?? "")}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      // 名称/值成对的选项：Vue 侧走独立弹窗，React 侧用多行输入等价录入
      case "optionPair":
        return (
          <UiControl
            as="Input"
            size="small"
            rows={4}
            value={String(current ?? "")}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      case "text":
        return (
          <UiControl
            as="Input"
            size="small"
            value={String(current ?? "")}
            onChange={(v: unknown) => set(field.key, v)}
          />
        );
      case "columns":
        return renderColumns(field);
      default:
        return null;
    }
  };

  return (
    <div className="props">
      <div className="props__head">
        <span className="props__chip">{material.title}</span>
        <span className="props__id" title={nodeId} onClick={copyId}>
          {nodeId}
        </span>
      </div>

      {material.hint ? <div className="props__hint">{material.hint}</div> : null}

      {sections.map((section) => (
        <section className="props__group" key={section.group}>
          <button
            type="button"
            className={`props__group-head${collapsed[section.group] ? " is-collapsed" : ""}`}
            onClick={() => toggle(section.group)}
          >
            <span className="props__group-arrow">▾</span>
            <span className="props__group-name">{FIELD_GROUP_LABELS[section.group]}</span>
            <span className="props__group-count">{section.fields.length}</span>
          </button>
          {/* 对齐 Vue 的 v-show：折叠只隐藏，不卸载已输入的内容 */}
          <div
            className="props__group-body"
            style={{ display: collapsed[section.group] ? "none" : undefined }}
          >
            {section.fields.map((field) => (
              <div className="props__row" key={field.key}>
                <div className="props__label">
                  <span>{field.label}</span>
                  {isCustom(field.key) ? (
                    <span className="props__dot" title="与默认值不同，会写入 Schema">
                      ●
                    </span>
                  ) : null}
                  {isBound(value(field.key)) ? <span className="props__bind">绑定</span> : null}
                  {/* 绑定选择器（ruUqAF）：列出可绑定数据，选一条即完成绑定 */}
                  <select
                    className="props__bind-select"
                    value=""
                    title="绑定页面数据"
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      applyBinding(field.key, event.target.value)
                    }
                  >
                    <option value="">🔗</option>
                    {bindables.map((item) => (
                      <option key={item.path} value={item.path}>
                        {item.group} · {item.label}（{item.path}）
                      </option>
                    ))}
                  </select>
                </div>

                {renderControl(field)}

                {field.tip ? <div className="props__tip">{field.tip}</div> : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      {!material.fields.length ? <div className="props__empty">该组件没有可配置属性</div> : null}
    </div>
  );
}
