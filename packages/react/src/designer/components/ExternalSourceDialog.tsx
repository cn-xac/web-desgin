/**
 * 外部数据源配置弹窗（对齐 Vue 的 ExternalSourceDialog.vue）。
 *
 * 关键约定（与 Vue 侧逐条一致）：
 * 1. 响应数据映射支持多条，各自写不同 scope 路径；
 * 2. 映射目标可选任意元素（含非表单元素），非表单元素的写入路径落在 data.<节点ID>；
 * 3. 响应映射整体可选：不配也能发请求（仅用于触发 / 写副作用）；
 * 4. 触发由「数据源所在元素自身的值」驱动，不再另选触发元素；
 * 5. 下拉用宿主 UI 库的 Select（设计态与运行时同观感）。
 *
 * 配置写在页面级 page.externalSources，本元素通过 externalRef 引用它；
 * 触发元素固定为「打开弹窗时点击的那个元素」。
 * 仅选项类目标会在保存时把它的 options 绑到结果路径。
 */
import { useEffect, useState } from "react";
import type {
  DataShape,
  ExternalDataSource,
  ExternalResponseMap,
  ExternalSubMap,
  Method,
} from "@x-ac/web-design-core";
import {
  canOwnExternalSource,
  collectBindableElements,
  findLocation,
  responsesOf,
} from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { useDesignerDialogs } from "../dialogs";
import type { ExternalTarget } from "../dialogs";
import { HelpTip } from "./HelpTip";
import { ModalShell } from "./ModalShell";
import { UiControl } from "../ui";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_OPTIONS = METHODS.map((method) => ({ label: method, value: method }));

/** 「显示内容」输入框的占位文案（JSX 里写 {{}} 没问题，但统一收在脚本里便于对照 Vue） */
const DISPLAY_PLACEHOLDER = "如 {{data.name}}/{{data.code}}（留空 = 用名称字段）";

interface DraftParam {
  key: string;
  path: string;
  label?: string;
}

interface DraftResponse {
  /** 选中目标元素（可空 = 只填路径，不强绑定元素） */
  targetNodeId: string;
  /** 写入 scope 的路径，可手改 */
  scopePath: string;
  listField: string;
  labelField: string;
  valueField: string;
  /** 显示内容模板：用 {{}} 从响应数据取数并自由拼接 */
  display: string;
  /** 父字段名（响应目标为子表单时）：明细数组所在的字段名 */
  parentField: string;
  /** 子映射（响应目标为子表单时）：响应行内各字段 → 子表单字段 */
  subMaps: ExternalSubMap[];
  /** 当前推断形态：选项类目标 → select，否则 form */
  shape: DataShape;
}

interface Draft {
  name: string;
  method: Method;
  url: string;
  headers: Record<string, string>;
  once: boolean;
  triggerLength: number;
  params: DraftParam[];
  responses: DraftResponse[];
}

const genSourceId = (): string => `ext_${Math.random().toString(36).slice(2, 10)}`;

const emptyResponse = (): DraftResponse => ({
  targetNodeId: "",
  scopePath: "",
  listField: "",
  labelField: "",
  valueField: "",
  display: "",
  parentField: "",
  subMaps: [],
  shape: "form",
});

export interface ExternalSourceDialogProps {
  target: ExternalTarget;
  onClose: () => void;
}

export function ExternalSourceDialog({ target, onClose }: ExternalSourceDialogProps) {
  const { store, state, registry, notify } = useDesigner();
  const dialogs = useDesignerDialogs();

  const node = findLocation(state.page.children ?? [], target.nodeId)?.node;
  /** 内容不可被用户改变的元素不允许拥有外部数据源 */
  const allowed = node ? canOwnExternalSource(node.component, registry) : false;

  /** 全部元素（含非表单元素）：用于参数 / 响应目标的下拉 */
  const elements = collectBindableElements(state.page, { registry, includeAll: true });

  const currentSource = (): ExternalDataSource | undefined => {
    const ref = node?.externalRef;
    return ref ? state.page.externalSources?.[ref] : undefined;
  };

  const [initial] = useState(() => {
    const source = currentSource();
    const responses = responsesOf(source).map((item) => ({
      targetNodeId: "",
      scopePath: item.scopePath,
      listField: item.listField ?? "",
      labelField: item.labelField ?? "",
      valueField: item.valueField ?? "",
      display: item.display ?? "",
      parentField: item.parentField ?? "",
      subMaps: (item.subMaps ?? []).map((map) => ({ ...map })),
      shape: (item.shape ?? "form") as DataShape,
    }));

    const draft: Draft = {
      name: source?.name ?? "",
      method: (source?.method ?? "GET") as Method,
      url: source?.url ?? "",
      headers: { ...(source?.headers ?? {}) },
      once: source?.once !== false,
      triggerLength: Number(source?.triggerLength ?? 0),
      params: (source?.params ?? []).map((item) => ({ ...item })),
      responses,
    };

    // 反查每个响应命中的目标节点（scopePath === 某元素路径）
    for (const resp of draft.responses) {
      const element = elements.find((item) => item.path === resp.scopePath);
      if (!element) continue;
      resp.targetNodeId = element.nodeId;
      resp.shape = element.isOption ? "select" : "form";
      if (element.isOption) {
        resp.labelField = resp.labelField || "label";
        resp.valueField = resp.valueField || "value";
      }
      if (element.isGroup && !resp.parentField) {
        resp.parentField = defaultParentField(element.path);
      }
    }

    return { sourceId: source?.id ?? genSourceId(), draft };
  });

  const [sourceId] = useState(initial.sourceId);
  const [draft, setDraft] = useState<Draft>(initial.draft);

  /** 兜底：内容不可变的元素打开弹窗即提示并关闭（与 Vue 的 watch 一致） */
  useEffect(() => {
    if (!node || allowed) return;
    notify("该元素的内容不可被用户改变，不能添加外部数据源", "error");
    onClose();
  }, [allowed, node, notify, onClose]);

  if (!node || !allowed) return null;

  const elementByNodeId = (nodeId: string) => elements.find((item) => item.nodeId === nodeId);
  const elementByPath = (path: string) => elements.find((item) => item.path === path);

  const isOptionTarget = (resp: DraftResponse): boolean =>
    Boolean(elementByNodeId(resp.targetNodeId)?.isOption);

  /** 目标是否为「可输入 / 下拉」类 —— 这类元素才需要「显示内容」模板 */
  const isValueTarget = (resp: DraftResponse): boolean => {
    const element = elementByNodeId(resp.targetNodeId);
    return Boolean(element && (element.isFormControl || element.isOption));
  };

  /** 目标是否为子表单（明细容器）—— 这类目标才需要「父字段名 + 子映射」 */
  const isGroupTarget = (resp: DraftResponse): boolean =>
    Boolean(elementByNodeId(resp.targetNodeId)?.isGroup);

  /** 页面里「可输入 / 下拉」类元素：外部数据源通常喂给这些元素 */
  const valueElements = elements.filter((item) => item.isFormControl || item.isOption);

  const elementOptions = elements.map((item) => ({
    label: `${item.label}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.path,
  }));

  const targetOptions = elements.map((item) => ({
    label: `${item.label}${item.isOption ? "（选项）" : ""}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.nodeId,
  }));

  const boundLabel = target.label || node.component || target.nodeId;
  const boundPath = elements.find((item) => item.nodeId === target.nodeId)?.path ?? "";
  const headerCount = Object.keys(draft.headers).length;

  /** 默认响应路径：external.<名称> */
  const defaultScopePath = (): string => {
    const key = (draft.name.trim() || "data").replace(/[^\w$一-龥]/g, "") || "data";
    return `external.${key}`;
  };

  /**
   * 响应映射的说明文案。
   * 收进标题栏的问号图标（HelpTip），鼠标指向时展示：
   * 说明正文铺在卡片里会把卡片撑得很高。
   */
  const tipOf = (resp: DraftResponse): string => {
    const parts: string[] = [];
    if (isGroupTarget(resp)) {
      parts.push(
        `响应数组的每一行会填成子表单的一条明细。父字段名「${resp.parentField || "（未填）"}」是明细数组所在的字段，子映射只需填它的子字段。`,
      );
    }
    if (isValueTarget(resp)) {
      parts.push(
        "「显示内容」支持用 {{}} 从响应数据取数并自由拼接（如 {{data.a}}/{{data.b}}）；下拉逐项渲染，输入框把整段响应渲染成字符串。",
      );
    }
    if (!resp.targetNodeId) {
      parts.push(`未选目标元素：结果整体写入 ${resp.scopePath}，由你自行把某元素属性绑到该路径。`);
    } else if (!isOptionTarget(resp)) {
      parts.push(`目标不是选项类元素，响应将整体写入 ${resp.scopePath} 的值。`);
    }
    if (!parts.length) {
      parts.push("选项类目标：响应按名称 / 值字段映射成选项；列表字段留空表示响应本身就是数组。");
    }
    return parts.join("\n");
  };

  const patchDraft = (partial: Partial<Draft>): void =>
    setDraft((current) => ({ ...current, ...partial }));

  /* ---------------- 参数映射 ---------------- */

  const addParam = (): void => patchDraft({ params: [...draft.params, { key: "", path: "" }] });

  const removeParam = (index: number): void =>
    patchDraft({ params: draft.params.filter((_, i) => i !== index) });

  const setParam = (index: number, partial: Partial<DraftParam>): void =>
    patchDraft({ params: draft.params.map((item, i) => (i === index ? { ...item, ...partial } : item)) });

  const onParamElement = (index: number, path: string): void =>
    setParam(index, { path, label: elementByPath(path)?.label });

  /* ---------------- 响应映射（多条） ---------------- */

  const patchResponse = (index: number, partial: Partial<DraftResponse>): void =>
    patchDraft({
      responses: draft.responses.map((item, i) => (i === index ? { ...item, ...partial } : item)),
    });

  const addResponse = (): void => {
    const resp = emptyResponse();
    resp.scopePath = defaultScopePath();
    // 只有一个「可输入 / 下拉」元素时默认选中目标，省去一次手动选择
    if (valueElements.length === 1) {
      const element = valueElements[0]!;
      resp.targetNodeId = element.nodeId;
      resp.scopePath = element.path;
      resp.shape = element.isOption ? "select" : "form";
      if (element.isOption) {
        resp.labelField = "label";
        resp.valueField = "value";
      }
    }
    patchDraft({ responses: [...draft.responses, resp] });
  };

  const removeResponse = (index: number): void =>
    patchDraft({ responses: draft.responses.filter((_, i) => i !== index) });

  const onResponseTarget = (index: number, nodeId: string): void => {
    const resp = draft.responses[index];
    if (!resp) return;
    const element = elementByNodeId(nodeId);
    const next: Partial<DraftResponse> = { targetNodeId: nodeId };
    if (element) {
      next.scopePath = element.path;
      next.shape = element.isOption ? "select" : "form";
      if (element.isOption) {
        next.labelField = resp.labelField || "label";
        next.valueField = resp.valueField || "value";
      }
      // 目标是子表单 → 给父字段名默认值；换成别的目标则清掉子映射
      next.parentField = element.isGroup ? defaultParentField(element.path) : "";
      if (!element.isGroup) next.subMaps = [];
    }
    patchResponse(index, next);
  };

  /** 打开子映射弹窗：取消时保留原有配置（resolve null 表示「没改」） */
  const openSubMap = async (index: number): Promise<void> => {
    const resp = draft.responses[index];
    if (!resp) return;
    const element = elementByNodeId(resp.targetNodeId);
    if (!element?.isGroup) return;
    const maps = await dialogs.openSubMap({
      responseIndex: index,
      parentField: resp.parentField,
      groupNodeId: resp.targetNodeId,
      label: element.label,
      maps: resp.subMaps,
    });
    if (maps) patchResponse(index, { subMaps: maps });
  };

  /* ---------------- 请求头 ---------------- */

  const openHeaders = async (): Promise<void> => {
    const rows = await dialogs.openHeaders(draft.headers);
    // null = 取消，保留原值；确认则整体覆盖（把请求头全删掉也必须生效）
    if (!rows) return;
    const cleaned: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) cleaned[key] = row.value;
    }
    patchDraft({ headers: cleaned });
  };

  /* ---------------- 保存 / 移除 ---------------- */

  /** 找出「选项类目标」对应的节点：它的 options 要绑到结果路径 */
  const optionNodeIdsOf = (responses: ExternalResponseMap[]): string[] => {
    const ids: string[] = [];
    for (const resp of responses) {
      const element = elements.find((item) => item.path === resp.scopePath && item.isOption);
      if (element) ids.push(element.nodeId);
    }
    return ids;
  };

  const buildSource = (): ExternalDataSource => {
    const source: ExternalDataSource = {
      id: sourceId || genSourceId(),
      method: draft.method,
      url: draft.url.trim(),
    };
    if (draft.name.trim()) source.name = draft.name.trim();
    if (Object.keys(draft.headers).length) source.headers = { ...draft.headers };

    const params = draft.params.filter((item) => item.key.trim() && item.path);
    if (params.length) {
      source.params = params.map((item) => ({ key: item.key.trim(), path: item.path, label: item.label }));
    }

    const responses = draft.responses
      .filter((resp) => resp.scopePath.trim())
      .map((resp): ExternalResponseMap => {
        const out: ExternalResponseMap = { scopePath: resp.scopePath.trim() };
        const element = elementByNodeId(resp.targetNodeId);
        if (element?.isOption) {
          // 选项类：恒为选项形态；value 不配则运行时回退到 label
          out.shape = "select";
          out.labelField = resp.labelField.trim() || "label";
          out.valueField = resp.valueField.trim();
        }
        if (resp.listField.trim()) out.listField = resp.listField.trim();
        // 显示内容模板：只对「可输入 / 下拉」目标有意义
        if (resp.display.trim()) out.display = resp.display.trim();
        // 父字段名 + 子映射：只对子表单目标有意义
        if (resp.parentField.trim()) out.parentField = resp.parentField.trim();
        if (resp.subMaps.length) {
          out.subMaps = resp.subMaps.map((map) => ({ field: map.field, from: map.from }));
        }
        return out;
      });
    if (responses.length) source.responses = responses;

    source.once = draft.once;
    if (draft.triggerLength > 0) source.triggerLength = draft.triggerLength;
    return source;
  };

  const save = (): void => {
    if (!draft.url.trim()) {
      notify("请填写请求地址", "error");
      return;
    }

    const prevIds = optionNodeIdsOf(responsesOf(currentSource()));
    const source = buildSource();
    store.upsertExternalSource(source);
    store.setNodeExternalRef(target.nodeId, source.id);

    // 选项类目标的 options 绑到结果路径；曾被绑定但本次不再绑定的要清掉，避免悬空引用
    const newIds = optionNodeIdsOf(source.responses ?? []);
    for (const id of prevIds) {
      if (!newIds.includes(id)) store.updateNodeProp(id, "options", "");
    }
    for (const id of newIds) {
      const scopePath = elementByNodeId(id)?.path;
      if (scopePath) store.updateNodeProp(id, "options", `{{${scopePath}}}`);
    }

    onClose();
    notify("外部数据源已保存", "success");
  };

  const remove = (): void => {
    const prevIds = optionNodeIdsOf(responsesOf(currentSource()));
    store.removeExternalSource(sourceId);
    store.setNodeExternalRef(target.nodeId, undefined);
    for (const id of prevIds) store.updateNodeProp(id, "options", "");
    onClose();
    notify("已移除外部数据源", "success");
  };

  return (
    <ModalShell
      title={`外部数据源 · ${target.label}`}
      width="620px"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ext__remove" onClick={remove}>
            移除数据源
          </button>
          <span className="ext__spacer" />
          <button type="button" className="ext__cancel" onClick={onClose}>
            取消
          </button>
          <button type="button" className="ext__ok" onClick={save}>
            保存
          </button>
        </>
      }
    >
      <div className="ext">
        {/* 基本信息 */}
        <div className="ext__row">
          <label className="ext__label">名称</label>
          <input
            className="ext__input"
            value={draft.name}
            placeholder="如 部门列表"
            spellCheck={false}
            onChange={(event) => patchDraft({ name: event.target.value })}
          />
        </div>

        <div className="ext__row ext__row--split">
          <div className="ext__cell">
            <label className="ext__label">请求方法</label>
            <UiControl
              as="Select"
              size="small"
              value={draft.method}
              options={METHOD_OPTIONS}
              onChange={(value: unknown) => patchDraft({ method: String(value) as Method })}
            />
          </div>
          <div className="ext__cell ext__cell--grow">
            <label className="ext__label">请求地址 URL</label>
            <input
              className="ext__input wb-mono"
              value={draft.url}
              placeholder="/api/dept/list"
              spellCheck={false}
              onChange={(event) => patchDraft({ url: event.target.value })}
            />
          </div>
        </div>

        <div className="ext__row">
          <label className="ext__label">请求头</label>
          <button type="button" className="ext__ghost" onClick={() => void openHeaders()}>
            {headerCount ? `已设置 ${headerCount} 个请求头` : "设置请求头…"}
          </button>
        </div>

        {/* 触发：本数据源绑定在点击的元素上，触发值即取自该元素 */}
        <div className="ext__row ext__row--split">
          <div className="ext__cell">
            <label className="ext__label">触发长度</label>
            <input
              className="ext__input"
              type="number"
              min={0}
              value={draft.triggerLength}
              placeholder="0 = 加载即取"
              onChange={(event) => patchDraft({ triggerLength: Number(event.target.value) || 0 })}
            />
          </div>
          <div className="ext__cell ext__cell--grow">
            <label className="ext__label">触发元素</label>
            <div className="ext__static" title={boundPath}>
              {boundLabel}
            </div>
          </div>
        </div>
        <div className="ext__note">
          本数据源绑定在「<b>{boundLabel}</b>」
          {boundPath ? <span>（{boundPath}）</span> : null}
          上，触发值取自该元素自身的值，无需另选触发元素。
        </div>

        <label className="ext__switch">
          <input
            type="checkbox"
            checked={draft.once}
            onChange={(event) => patchDraft({ once: event.target.checked })}
          />
          <span>只请求一次（当前页面仅请求一次）</span>
        </label>

        {/* 请求参数映射 */}
        <div className="ext__section">
          请求参数映射
          <span className="ext__section-hint">只能选当前页面的元素；整组子表单可作为单个参数值</span>
        </div>
        <div className="ext__params">
          {draft.params.map((item, index) => (
            <div className="ext__param" key={index}>
              <input
                className="ext__input"
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
              <button type="button" className="ext__del" title="删除" onClick={() => removeParam(index)}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="ext__ghost ext__ghost--block" onClick={addParam}>
            + 添加参数
          </button>
        </div>

        {/* 响应数据映射（多条） */}
        <div className="ext__section">
          响应数据映射
          <span className="ext__section-hint">可设多条，各自写不同路径；留空则不写数据（仅触发请求）</span>
        </div>
        <div className="ext__params">
          {draft.responses.map((resp, index) => (
            <div className="ext__resp" key={index}>
              <div className="ext__resp-head">
                <span className="ext__resp-no">映射 {index + 1}</span>
                <HelpTip text={tipOf(resp)} />
                <button
                  type="button"
                  className="ext__del"
                  title="删除映射"
                  onClick={() => removeResponse(index)}
                >
                  ×
                </button>
              </div>
              {/* 目标元素 + 列表字段：两项各占一半宽度 */}
              <div className="ext__resp-target">
                <UiControl
                  as="Select"
                  size="small"
                  clearable
                  filterable
                  placeholder="选择目标元素（可空）"
                  value={resp.targetNodeId}
                  options={targetOptions}
                  onChange={(value: unknown) => onResponseTarget(index, String(value ?? ""))}
                />
                <input
                  className="ext__input wb-mono"
                  value={resp.listField}
                  placeholder="列表字段，如 data.list"
                  spellCheck={false}
                  onChange={(event) => patchResponse(index, { listField: event.target.value })}
                />
              </div>
              <div className="ext__row">
                <label className="ext__label">写入路径</label>
                <input
                  className="ext__input wb-mono"
                  value={resp.scopePath}
                  placeholder="如 external.deptList"
                  spellCheck={false}
                  onChange={(event) => patchResponse(index, { scopePath: event.target.value })}
                />
              </div>
              {isGroupTarget(resp) ? (
                <div className="ext__row ext__row--split">
                  <div className="ext__cell">
                    <label className="ext__label">父字段名</label>
                    <input
                      className="ext__input wb-mono"
                      value={resp.parentField}
                      placeholder="如 items"
                      spellCheck={false}
                      onChange={(event) => patchResponse(index, { parentField: event.target.value })}
                    />
                  </div>
                  <div className="ext__cell ext__cell--grow">
                    <label className="ext__label">子映射</label>
                    <button type="button" className="ext__ghost" onClick={() => void openSubMap(index)}>
                      {resp.subMaps.length ? `已配置 ${resp.subMaps.length} 项` : "设置子映射…"}
                    </button>
                  </div>
                </div>
              ) : null}
              {isOptionTarget(resp) ? (
                <div className="ext__row ext__row--split">
                  <div className="ext__cell">
                    <label className="ext__label">值字段</label>
                    <input
                      className="ext__input wb-mono"
                      value={resp.valueField}
                      placeholder="留空 = 用名称"
                      spellCheck={false}
                      onChange={(event) => patchResponse(index, { valueField: event.target.value })}
                    />
                  </div>
                  <div className="ext__cell">
                    <label className="ext__label">名称字段</label>
                    <input
                      className="ext__input wb-mono"
                      value={resp.labelField}
                      placeholder="label"
                      spellCheck={false}
                      onChange={(event) => patchResponse(index, { labelField: event.target.value })}
                    />
                  </div>
                </div>
              ) : null}
              {isValueTarget(resp) ? (
                <div className="ext__row">
                  <label className="ext__label">显示内容</label>
                  <input
                    className="ext__input wb-mono"
                    value={resp.display}
                    placeholder={DISPLAY_PLACEHOLDER}
                    spellCheck={false}
                    onChange={(event) => patchResponse(index, { display: event.target.value })}
                  />
                </div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ext__ghost ext__ghost--block" onClick={addResponse}>
            + 添加响应映射
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * 父字段名默认值：明细数组所在字段（元素路径的最后一段）。
 * 放在组件外：纯函数，不依赖任何状态。
 */
function defaultParentField(path: string): string {
  const segment = path.split(".").pop() ?? "";
  return segment.replace(/\[\d+\]$/, "");
}
