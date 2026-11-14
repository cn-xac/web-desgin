/**
 * 选项录入弹窗（对齐 Vue 的 OptionsDialog.vue）。
 *
 * 两种选项来源互斥呈现：
 * 1. 手工录入：一行一个「名称 值」，存进 Schema 的多行文本；
 * 2. 选项数据源：从接口取选项，只需配置 label / value 映射 ——
 *    label 必填，value 留空则运行时默认等于 label。配置后 options 自动绑到结果路径。
 *
 * 选项数据源本质就是一条页面级外部数据源（asOptions: true，单个 select 形态响应），
 * 节点通过 externalRef 引用；与「外部数据源」共用同一套运行时，这里只是更省心的录入入口。
 */
import { useState } from "react";
import type { ExternalDataSource, ExternalResponseMap, Method } from "@x-ac/web-design-core";
import {
  collectBindableElements,
  findLocation,
  parseOptionLines,
  responsesOf,
  toOptionLines,
} from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { useDesignerDialogs } from "../dialogs";
import type { OptionsTarget } from "../dialogs";
import { ModalShell } from "./ModalShell";
import { UiControl } from "../ui";

interface OptParam {
  key: string;
  path: string;
  label?: string;
}

interface OptDraft {
  url: string;
  method: Method;
  params: OptParam[];
  listField: string;
  labelField: string;
  valueField: string;
  once: boolean;
}

const genSourceId = (): string => `ext_${Math.random().toString(36).slice(2, 10)}`;

const emptyDraft = (): OptDraft => ({
  url: "",
  method: "GET",
  params: [],
  listField: "",
  labelField: "label",
  valueField: "",
  once: true,
});

const METHOD_OPTIONS = [
  { label: "GET", value: "GET" },
  { label: "POST", value: "POST" },
];

export interface OptionsDialogProps {
  target: OptionsTarget;
  onClose: () => void;
}

export function OptionsDialog({ target, onClose }: OptionsDialogProps) {
  const { store, state, registry, notify } = useDesigner();
  const dialogs = useDesignerDialogs();

  /** 目标节点：弹窗打开期间选中项可能被改，按 nodeId 取，别跟着选中项漂 */
  const node = findLocation(state.page.children ?? [], target.nodeId)?.node;

  // 首帧就把草案按现有配置装好（弹窗每次打开都是新实例，不存在陈旧状态）
  const [initial] = useState(() => {
    const text = toOptionLines(node?.props?.options);
    const ref = node?.externalRef;
    const source = ref ? state.page.externalSources?.[ref] : undefined;
    const enabled = Boolean(source?.url && source.asOptions && responsesOf(source)[0]);
    if (enabled && source) {
      const resp = responsesOf(source)[0]!;
      return {
        text,
        optOn: true,
        sourceId: source.id,
        draft: {
          url: source.url,
          method: (source.method ?? "GET") as Method,
          params: (source.params ?? []).map((item) => ({ ...item })),
          listField: resp.listField ?? "",
          labelField: resp.labelField ?? "label",
          valueField: resp.valueField ?? "",
          once: source.once !== false,
        } satisfies OptDraft,
      };
    }
    return { text, optOn: false, sourceId: genSourceId(), draft: emptyDraft() };
  });

  const [text, setText] = useState(initial.text);
  const [optOn, setOptOn] = useState(initial.optOn);
  const [sourceId] = useState(initial.sourceId);
  const [draft, setDraft] = useState<OptDraft>(initial.draft);

  /** 参数可选元素（表单控件，参数只取有值的元素） */
  const elements = collectBindableElements(state.page, { registry });
  const elementOptions = elements.map((item) => ({
    label: `${item.label}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.path,
  }));

  const preview = parseOptionLines(text);

  const patch = (partial: Partial<OptDraft>): void => setDraft((current) => ({ ...current, ...partial }));

  const addParam = (): void => patch({ params: [...draft.params, { key: "", path: "" }] });

  const removeParam = (index: number): void =>
    patch({ params: draft.params.filter((_, i) => i !== index) });

  const setParam = (index: number, partial: Partial<OptParam>): void =>
    patch({ params: draft.params.map((item, i) => (i === index ? { ...item, ...partial } : item)) });

  const onParamElement = (index: number, path: string): void =>
    setParam(index, { path, label: elements.find((el) => el.path === path)?.label });

  const save = (): void => {
    // 选项数据源模式
    if (optOn) {
      if (!draft.url.trim()) {
        notify("请填写请求地址", "error");
        return;
      }
      if (!draft.labelField.trim()) {
        notify("请填写名称字段（label 必填）", "error");
        return;
      }
      const nodeId = node?.id;
      if (!nodeId) return;
      const scopePath = `options.${nodeId}`;
      const source: ExternalDataSource = {
        id: sourceId || genSourceId(),
        url: draft.url.trim(),
        method: draft.method,
        once: draft.once,
        asOptions: true,
        params: draft.params
          .filter((item) => item.key.trim() && item.path)
          .map((item) => ({ key: item.key.trim(), path: item.path, label: item.label })),
        responses: [
          {
            scopePath,
            shape: "select",
            labelField: draft.labelField.trim(),
            valueField: draft.valueField.trim(),
          } as ExternalResponseMap,
        ],
      };
      store.upsertExternalSource(source);
      store.setNodeExternalRef(nodeId, source.id);
      store.updateNodeProp(nodeId, "options", `{{${scopePath}}}`);
      onClose();
      notify("选项数据源已保存", "success");
      return;
    }

    // 关闭选项数据源：若之前是 asOptions 源，清掉以免遗留
    const existingRef = node?.externalRef;
    if (existingRef) {
      const existing = state.page.externalSources?.[existingRef];
      if (existing?.asOptions) {
        store.removeExternalSource(existing.id);
        store.setNodeExternalRef(target.nodeId, undefined);
      }
    }
    store.updateProp(target.key, text);
    onClose();
    notify("选项已更新", "success");
  };

  const clear = (): void => {
    if (optOn) return;
    store.updateProp(target.key, "");
    onClose();
  };

  const openExternal = (): void => {
    onClose();
    dialogs.openExternal({ nodeId: target.nodeId, label: target.label });
  };

  return (
    <ModalShell
      title={`编辑${target.label}`}
      width="560px"
      onClose={onClose}
      footer={
        <>
          {!optOn ? (
            <button type="button" className="opts__clear" onClick={clear}>
              清空
            </button>
          ) : null}
          <span className="opts__spacer" />
          <button type="button" className="opts__cancel" onClick={onClose}>
            取消
          </button>
          <button type="button" className="opts__ok" onClick={save}>
            确定
          </button>
        </>
      }
    >
      {/* 选项数据源开关 */}
      <div className="opts__source">
        <label className="opts__source-switch">
          <input type="checkbox" checked={optOn} onChange={(event) => setOptOn(event.target.checked)} />
          <span>使用选项数据源（从接口取选项）</span>
        </label>
      </div>

      {optOn ? (
        <div className="opts__source-conf">
          <div className="opts__row">
            <label className="opts__label">请求方法</label>
            <UiControl
              as="Select"
              size="small"
              value={draft.method}
              options={METHOD_OPTIONS}
              onChange={(value: unknown) => patch({ method: String(value) as Method })}
            />
          </div>
          <div className="opts__row">
            <label className="opts__label">请求地址</label>
            <input
              className="opts__input wb-mono"
              value={draft.url}
              placeholder="/api/dict/list"
              spellCheck={false}
              onChange={(event) => patch({ url: event.target.value })}
            />
          </div>

          <div className="opts__section">请求参数（可选，来自页面元素）</div>
          <div className="opts__params">
            {draft.params.map((item, index) => (
              <div className="opts__param" key={index}>
                <input
                  className="opts__input"
                  value={item.key}
                  placeholder="参数名"
                  spellCheck={false}
                  onChange={(event) => setParam(index, { key: event.target.value })}
                />
                <UiControl
                  as="Select"
                  size="small"
                  clearable
                  filterable
                  placeholder="选择元素…"
                  value={item.path}
                  options={elementOptions}
                  onChange={(value: unknown) => onParamElement(index, String(value ?? ""))}
                />
                <button type="button" className="opts__del" title="删除" onClick={() => removeParam(index)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="opts__ghost--block" onClick={addParam}>
              + 添加参数
            </button>
          </div>

          <div className="opts__row">
            <label className="opts__label">列表字段</label>
            <input
              className="opts__input wb-mono"
              value={draft.listField}
              placeholder="如 data.list（留空=响应本身即数组）"
              spellCheck={false}
              onChange={(event) => patch({ listField: event.target.value })}
            />
          </div>
          <div className="opts__row opts__row--split">
            <div className="opts__cell">
              <label className="opts__label">
                名称字段 <em className="opts__req">*</em>
              </label>
              <input
                className="opts__input wb-mono"
                value={draft.labelField}
                placeholder="label"
                spellCheck={false}
                onChange={(event) => patch({ labelField: event.target.value })}
              />
            </div>
            <div className="opts__cell">
              <label className="opts__label">值字段</label>
              <input
                className="opts__input wb-mono"
                value={draft.valueField}
                placeholder="留空 = 用名称"
                spellCheck={false}
                onChange={(event) => patch({ valueField: event.target.value })}
              />
            </div>
          </div>
          <label className="opts__switch">
            <input type="checkbox" checked={draft.once} onChange={(event) => patch({ once: event.target.checked })} />
            <span>只请求一次</span>
          </label>
          <div className="opts__tip">
            运行时由接口返回并映射为选项的「名称 / 值」；未设值字段时值默认等于名称。结果写入
            <code>options.{node?.id}</code>，本元素的 options 已自动绑定。
          </div>
          <button type="button" className="opts__adv" onClick={openExternal}>
            需要多条响应 / 缓存策略等高级配置？打开「外部数据源」 →
          </button>
        </div>
      ) : (
        <>
          <div className="opts__hint">
            每行一个选项，<b>名称在前、值在后</b>，中间用空格隔开（多个空格也行）。
            <br />
            只写名称时，值与名称相同。示例：<code>技术中心&nbsp;&nbsp;tech</code>
          </div>

          <textarea
            className="opts__text wb-mono"
            rows={9}
            spellCheck={false}
            value={text}
            placeholder={"技术中心  tech\n产品中心  product"}
            onChange={(event) => setText(event.target.value)}
          />

          <div className="opts__preview-head">
            <span>解析结果</span>
            <span className="opts__count">{preview.length} 项</span>
          </div>
          <div className="opts__preview wb-scroll">
            {!preview.length ? <div className="opts__preview-empty">还没有选项</div> : null}
            {preview.map((item, index) => (
              <div className="opts__preview-row" key={index}>
                <span className="opts__preview-label">{item.label}</span>
                <span className="opts__preview-arrow">→</span>
                <span className="opts__preview-value">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}
