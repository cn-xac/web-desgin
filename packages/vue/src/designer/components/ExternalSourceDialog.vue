<script setup lang="ts">
/**
 * 外部数据源配置弹窗（rg4KCt / 本次增强）。
 *
 * 本次针对反馈的改造：
 * 1. 响应数据映射支持多条（仿参数映射，可增删），各自写不同 scope 路径（#4）；
 * 2. 映射目标可任选「任意元素」（含非表单元素，#1）—— 非表单元素的写入路径落在 data.<节点ID>；
 * 3. 响应映射整体可选：不配也能发请求（例如仅用于触发 / 写副作用，#2）；
 * 4. 触发由「数据源所在元素自身的值」或「额外选中的参数」驱动，不依赖绑定元素（#2）；
 * 5. 下拉全部改用宿主 UI 库的 Select（设计态与运行时同观感）并支持搜索（#3）。
 *
 * 配置写在页面级 page.externalSources，本元素通过 externalRef 引用它：
 * 触发元素固定为「打开弹窗时点击的那个元素」，弹窗不再提供触发元素选择。
 *
 * 仅选项类目标会在保存时把它的 options 绑到结果路径（取数与 label/value 映射都归本弹窗管）。
 */
import { computed, reactive, ref, watch } from "vue";
import type { DataShape, ExternalDataSource, ExternalResponseMap, ExternalSubMap } from "@x-ac/web-design-core";
import {
  canOwnExternalSource,
  collectBindableElements,
  findLocation,
  responsesOf,
  type BindableElement,
  type Method,
} from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import { useExternalSourceDialog, useHeadersDialog, useSubMapDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const dialog = useExternalSourceDialog();
const headersDialog = useHeadersDialog();
const subMapDialog = useSubMapDialog();
const notify = useNotify();

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_OPTIONS = METHODS.map((m) => ({ label: m, value: m }));

/**
 * 「显示内容」输入框的占位文案。
 * 模板里直接写 {{}} 会被 Vue 当成插值解析，所以这类文案统一放脚本里。
 */
const DISPLAY_PLACEHOLDER = "如 {{data.name}}/{{data.code}}（留空 = 用名称字段）";

interface DraftParam {
  key: string;
  path: string;
  label?: string;
}
interface DraftResponse {
  /** 选中目标元素（可空 = 只填路径，不强绑定元素，#2） */
  targetNodeId: string;
  /** 写入 scope 的路径，可手改 */
  scopePath: string;
  listField: string;
  labelField: string;
  valueField: string;
  /** 显示内容模板：用 {{}} 从响应数据取数并自由拼接（#3） */
  display: string;
  /** 父字段名（响应目标为子表单时）：明细数组所在的字段名 */
  parentField: string;
  /** 子映射（响应目标为子表单时）：响应行内各字段 → 子表单字段 */
  subMaps: ExternalSubMap[];
  /** 当前推断形态：选项类目标 → select，否则 form */
  shape: DataShape;
}

const draft = reactive({
  name: "",
  method: "GET" as Method,
  url: "",
  headers: {} as Record<string, string>,
  once: true,
  triggerLength: 0,
  params: [] as DraftParam[],
  responses: [] as DraftResponse[],
});

/** 当前编辑的外部数据源 id（新建时生成，保存即作为 page.externalSources 的键） */
const currentSourceId = ref("");
function genSourceId(): string {
  return `ext_${Math.random().toString(36).slice(2, 10)}`;
}

/** 当前节点引用的页面级外部数据源（若有） */
function currentSource(): ExternalDataSource | undefined {
  const ref = node.value?.externalRef;
  return ref ? store.page.externalSources?.[ref] : undefined;
}

const node = computed(() => {
  const target = dialog.target.value;
  if (!target) return undefined;
  return findLocation(store.page.children, target.nodeId)?.node;
});

/** 全部元素（含非表单元素，#1）：用于参数 / 触发 / 响应目标的下拉 */
const elements = computed(() => collectBindableElements(store.page, { registry: catalog, includeAll: true }));

/** 按路径选择的元素下拉（参数 / 触发用） */
const elementOptions = computed(() =>
  elements.value.map((item) => ({
    label: `${item.label}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.path,
  })),
);

/** 按节点选择的元素下拉（响应目标用，便于自动判定「选项类」） */
const targetOptions = computed(() =>
  elements.value.map((item) => ({
    label: `${item.label}${item.isOption ? "（选项）" : ""}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.nodeId,
  })),
);

/** 本数据源绑定的元素：打开弹窗时点击的那个（触发值即取自它） */
const boundLabel = computed(() => {
  const target = dialog.target.value;
  if (!target) return "";
  return target.label || node.value?.component || target.nodeId;
});

/** 绑定元素实际的数据路径（仅用于展示） */
const boundPath = computed(() => {
  const target = dialog.target.value;
  if (!target) return "";
  return elements.value.find((el) => el.nodeId === target.nodeId)?.path ?? "";
});

function elementByNodeId(nodeId: string): BindableElement | undefined {
  return elements.value.find((item) => item.nodeId === nodeId);
}
function elementByPath(path: string): BindableElement | undefined {
  return elements.value.find((item) => item.path === path);
}
function isOptionTarget(resp: DraftResponse): boolean {
  return Boolean(elementByNodeId(resp.targetNodeId)?.isOption);
}

/** 目标是否为「可输入 / 下拉」类 —— 这类元素才需要「显示内容」模板（#3） */
function isValueTarget(resp: DraftResponse): boolean {
  const el = elementByNodeId(resp.targetNodeId);
  return Boolean(el && (el.isFormControl || el.isOption));
}

/** 目标是否为子表单（明细容器）—— 这类目标才需要「父字段名 + 子映射」（#4） */
function isGroupTarget(resp: DraftResponse): boolean {
  return Boolean(elementByNodeId(resp.targetNodeId)?.isGroup);
}

/** 父字段名默认值：明细数组所在字段（元素路径的最后一段） */
function defaultParentField(el: BindableElement): string {
  const segment = el.path.split(".").pop() ?? "";
  return segment.replace(/\[\d+\]$/, "");
}

/**
 * 响应映射的说明文案。
 * 收进标题栏的问号图标、鼠标指向时展示：说明正文铺在卡片里会把卡片撑得很高。
 */
function tipOf(resp: DraftResponse): string {
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
}

/** 页面里「可输入 / 下拉」类元素：外部数据源通常喂给这些元素 */
const valueElements = computed(() => elements.value.filter((el) => el.isFormControl || el.isOption));

const headerCount = computed(() => Object.keys(draft.headers).length);

/** 默认响应路径：external.<名称> */
function defaultScopePath(): string {
  const key = (draft.name.trim() || "data").replace(/[^\w$一-龥]/g, "") || "data";
  return `external.${key}`;
}

function reset(): void {
  const source = currentSource();
  currentSourceId.value = source?.id ?? genSourceId();
  Object.assign(draft, {
    name: source?.name ?? "",
    method: (source?.method ?? "GET") as Method,
    url: source?.url ?? "",
    headers: { ...(source?.headers ?? {}) },
    once: source?.once !== false,
    triggerLength: Number(source?.triggerLength ?? 0),
    params: (source?.params ?? []).map((item) => ({ ...item })),
    responses: responsesOf(source).map((r) => ({
      targetNodeId: "",
      scopePath: r.scopePath,
      listField: r.listField ?? "",
      labelField: r.labelField ?? "",
      valueField: r.valueField ?? "",
      display: r.display ?? "",
      parentField: r.parentField ?? "",
      subMaps: (r.subMaps ?? []).map((m) => ({ ...m })),
      shape: r.shape ?? "form",
    })),
  });
  // 反查每个响应命中的目标节点（scopePath === 某元素路径）
  for (const resp of draft.responses) {
    const el = elements.value.find((e) => e.path === resp.scopePath);
    if (el) {
      resp.targetNodeId = el.nodeId;
      resp.shape = el.isOption ? "select" : "form";
      if (el.isOption) {
        resp.labelField = resp.labelField || "label";
        resp.valueField = resp.valueField || "value";
      }
      if (el.isGroup && !resp.parentField) resp.parentField = defaultParentField(el);
    }
  }
}

watch(
  () => [dialog.visible.value, dialog.target.value?.nodeId] as const,
  ([visible]) => {
    if (!visible) return;
    const target = node.value;
    // 兜底：内容不可被用户改变的元素不允许拥有外部数据源
    if (target && !canOwnExternalSource(target.component, catalog)) {
      notify("该元素的内容不可被用户改变，不能添加外部数据源", "error");
      dialog.close();
      return;
    }
    reset();
  },
  { immediate: true },
);

/* ---------------- 参数映射 ---------------- */

function addParam(): void {
  draft.params.push({ key: "", path: "" });
}
function removeParam(index: number): void {
  draft.params.splice(index, 1);
}
function onParamElement(index: number, path: string): void {
  const item = draft.params[index];
  if (!item) return;
  item.path = path;
  item.label = elementByPath(path)?.label;
}

/* ---------------- 响应映射（多条，#4） ---------------- */

function addResponse(): void {
  const resp: DraftResponse = {
    targetNodeId: "",
    scopePath: defaultScopePath(),
    listField: "",
    labelField: "",
    valueField: "",
    display: "",
    parentField: "",
    subMaps: [],
    shape: "form",
  };
  // 只有一个「可输入 / 下拉」元素时默认选中目标，省去一次手动选择（#3）
  if (valueElements.value.length === 1) {
    const el = valueElements.value[0]!;
    resp.targetNodeId = el.nodeId;
    resp.scopePath = el.path;
    resp.shape = el.isOption ? "select" : "form";
    if (el.isOption) {
      resp.labelField = "label";
      resp.valueField = "value";
    }
  }
  draft.responses.push(resp);
}
function removeResponse(index: number): void {
  draft.responses.splice(index, 1);
}
function onResponseTarget(index: number, nodeId: string): void {
  const resp = draft.responses[index];
  if (!resp) return;
  resp.targetNodeId = nodeId;
  const el = elementByNodeId(nodeId);
  if (el) {
    resp.scopePath = el.path;
    resp.shape = el.isOption ? "select" : "form";
    if (el.isOption) {
      resp.labelField = resp.labelField || "label";
      resp.valueField = resp.valueField || "value";
    }
    // 目标是子表单 → 给父字段名默认值；换成别的目标则清掉子映射
    resp.parentField = el.isGroup ? defaultParentField(el) : "";
    if (!el.isGroup) resp.subMaps = [];
  }
}

/**
 * 打开子映射弹窗（#4）。
 * 取消时保留原有配置（弹窗 resolve null 表示「没改」）。
 */
async function openSubMap(index: number): Promise<void> {
  const resp = draft.responses[index];
  if (!resp) return;
  const el = elementByNodeId(resp.targetNodeId);
  if (!el?.isGroup) return;
  const maps = await subMapDialog.open({
    responseIndex: index,
    parentField: resp.parentField,
    groupNodeId: resp.targetNodeId,
    label: el.label,
    maps: resp.subMaps,
  });
  if (maps) resp.subMaps = maps;
}

/* ---------------- 请求头 ---------------- */

async function openHeaders(): Promise<void> {
  const rows = await headersDialog.open(draft.headers);
  // null = 取消，保留原值；确认则整体覆盖（把请求头全删掉也必须生效）
  if (!rows) return;
  const cleaned: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) cleaned[key] = row.value;
  }
  draft.headers = cleaned;
}

/* ---------------- 保存 / 移除 ---------------- */

/** 找出「选项类目标」对应的节点：它的 options 要绑到结果路径 */
function optionNodeIdsOf(responses: ExternalResponseMap[]): string[] {
  const ids: string[] = [];
  for (const r of responses) {
    const el = elements.value.find((e) => e.path === r.scopePath && e.isOption);
    if (el) ids.push(el.nodeId);
  }
  return ids;
}

function buildSource(): ExternalDataSource {
  const source: ExternalDataSource = {
    id: currentSourceId.value || genSourceId(),
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
    .filter((r) => r.scopePath.trim())
    .map((r): ExternalResponseMap => {
      const out: ExternalResponseMap = { scopePath: r.scopePath.trim() };
      const el = elementByNodeId(r.targetNodeId);
      if (el?.isOption) {
        // 选项类：恒为选项形态；value 不配则运行时回退到 label（#5）
        out.shape = "select";
        out.labelField = r.labelField.trim() || "label";
        out.valueField = r.valueField.trim();
      }
      if (r.listField.trim()) out.listField = r.listField.trim();
      // 显示内容模板：只对「可输入 / 下拉」目标有意义（#3）
      if (r.display.trim()) out.display = r.display.trim();
      // 父字段名 + 子映射：只对子表单目标有意义（#4）
      if (r.parentField.trim()) out.parentField = r.parentField.trim();
      if (r.subMaps.length) {
        out.subMaps = r.subMaps.map((m) => ({ field: m.field, from: m.from }));
      }
      return out;
    });
  if (responses.length) source.responses = responses;

  source.once = draft.once;
  if (draft.triggerLength > 0) {
    source.triggerLength = draft.triggerLength;
  }
  return source;
}

function save(): void {
  const target = dialog.target.value;
  if (!target) return;
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

  dialog.close();
  notify("外部数据源已保存", "success");
}

function remove(): void {
  const target = dialog.target.value;
  if (!target) return;
  const prevIds = optionNodeIdsOf(responsesOf(currentSource()));
  store.removeExternalSource(currentSourceId.value);
  store.setNodeExternalRef(target.nodeId, undefined);
  for (const id of prevIds) store.updateNodeProp(id, "options", "");
  dialog.close();
  notify("已移除外部数据源", "success");
}
</script>

<template>
  <ModalShell
    v-if="dialog.visible.value && dialog.target.value"
    :title="`外部数据源 · ${dialog.target.value.label}`"
    width="620px"
    @close="dialog.close()"
  >
    <div class="ext">
      <!-- 基本信息 -->
      <div class="ext__row">
        <label class="ext__label">名称</label>
        <input v-model="draft.name" class="ext__input" placeholder="如 部门列表" spellcheck="false" />
      </div>

      <div class="ext__row ext__row--split">
        <div class="ext__cell">
          <label class="ext__label">请求方法</label>
          <UiControl as="Select" v-model="draft.method" :options="METHOD_OPTIONS" size="small" />
        </div>
        <div class="ext__cell ext__cell--grow">
          <label class="ext__label">请求地址 URL</label>
          <input v-model="draft.url" class="ext__input wb-mono" placeholder="/api/dept/list" spellcheck="false" />
        </div>
      </div>

      <div class="ext__row">
        <label class="ext__label">请求头</label>
        <button type="button" class="ext__ghost" @click="openHeaders">
          {{ headerCount ? `已设置 ${headerCount} 个请求头` : "设置请求头…" }}
        </button>
      </div>

      <!-- 触发：本数据源绑定在点击的元素上，触发值即取自该元素 -->
      <div class="ext__row ext__row--split">
        <div class="ext__cell">
          <label class="ext__label">触发长度</label>
          <input
            v-model.number="draft.triggerLength"
            class="ext__input"
            type="number"
            min="0"
            placeholder="0 = 加载即取"
          />
        </div>
        <div class="ext__cell ext__cell--grow">
          <label class="ext__label">触发元素</label>
          <div class="ext__static" :title="boundPath">{{ boundLabel }}</div>
        </div>
      </div>
      <div class="ext__note">
        本数据源绑定在「<b>{{ boundLabel }}</b>」<span v-if="boundPath">（{{ boundPath }}）</span>
        上，触发值取自该元素自身的值，无需另选触发元素。
      </div>

      <label class="ext__switch">
        <input v-model="draft.once" type="checkbox" />
        <span>只请求一次（当前页面仅请求一次）</span>
      </label>

      <!-- 请求参数映射 -->
      <div class="ext__section">
        请求参数映射
        <span class="ext__section-hint">只能选当前页面的元素；整组子表单可作为单个参数值</span>
      </div>
      <div class="ext__params">
        <div v-for="(item, index) in draft.params" :key="index" class="ext__param">
          <input v-model="item.key" class="ext__input" placeholder="参数名" spellcheck="false" />
          <UiControl
            as="Select"
            :model-value="item.path"
            :options="elementOptions"
            filterable
            clearable
            size="small"
            placeholder="选择元素…"
            @update:model-value="(v: string) => onParamElement(index, v)"
          />
          <button type="button" class="ext__del" title="删除" @click="removeParam(index)">×</button>
        </div>
        <button type="button" class="ext__ghost ext__ghost--block" @click="addParam">+ 添加参数</button>
      </div>

      <!-- 响应数据映射（多条，#4） -->
      <div class="ext__section">
        响应数据映射
        <span class="ext__section-hint">可设多条，各自写不同路径；留空则不写数据（仅触发请求）</span>
      </div>
      <div class="ext__params">
        <div v-for="(resp, index) in draft.responses" :key="index" class="ext__resp">
          <div class="ext__resp-head">
            <span class="ext__resp-no">映射 {{ index + 1 }}</span>
            <span class="ext__help" :data-tip="tipOf(resp)">?</span>
            <button type="button" class="ext__del" title="删除映射" @click="removeResponse(index)">×</button>
          </div>
          <!-- 目标元素 + 列表字段：两项各占一半宽度 -->
          <div class="ext__resp-target">
            <UiControl
              as="Select"
              :model-value="resp.targetNodeId"
              :options="targetOptions"
              filterable
              clearable
              size="small"
              placeholder="选择目标元素（可空）"
              @update:model-value="(v: string) => onResponseTarget(index, v)"
            />
            <input
              v-model="resp.listField"
              class="ext__input wb-mono"
              placeholder="列表字段，如 data.list"
              spellcheck="false"
            />
          </div>
          <div class="ext__row">
            <label class="ext__label">写入路径</label>
            <input v-model="resp.scopePath" class="ext__input wb-mono" placeholder="如 external.deptList" spellcheck="false" />
          </div>
          <div v-if="isGroupTarget(resp)" class="ext__row ext__row--split">
            <div class="ext__cell">
              <label class="ext__label">父字段名</label>
              <input v-model="resp.parentField" class="ext__input wb-mono" placeholder="如 items" spellcheck="false" />
            </div>
            <div class="ext__cell ext__cell--grow">
              <label class="ext__label">子映射</label>
              <button type="button" class="ext__ghost" @click="openSubMap(index)">
                {{ resp.subMaps.length ? `已配置 ${resp.subMaps.length} 项` : "设置子映射…" }}
              </button>
            </div>
          </div>
          <div v-if="isOptionTarget(resp)" class="ext__row ext__row--split">
            <div class="ext__cell">
              <label class="ext__label">值字段</label>
              <input v-model="resp.valueField" class="ext__input wb-mono" placeholder="留空 = 用名称" spellcheck="false" />
            </div>
            <div class="ext__cell">
              <label class="ext__label">名称字段</label>
              <input v-model="resp.labelField" class="ext__input wb-mono" placeholder="label" spellcheck="false" />
            </div>
          </div>
          <div v-if="isValueTarget(resp)" class="ext__row">
            <label class="ext__label">显示内容</label>
            <input
              v-model="resp.display"
              class="ext__input wb-mono"
              :placeholder="DISPLAY_PLACEHOLDER"
              spellcheck="false"
            />
          </div>
        </div>
        <button type="button" class="ext__ghost ext__ghost--block" @click="addResponse">+ 添加响应映射</button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="ext__remove" @click="remove">移除数据源</button>
      <span class="ext__spacer" />
      <button type="button" class="ext__cancel" @click="dialog.close()">取消</button>
      <button type="button" class="ext__ok" @click="save">保存</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.ext {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ext__row {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: 10px;
}
.ext__row--split {
  grid-template-columns: 1fr 1fr;
}
.ext__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ext__cell--grow {
  flex: 1;
}
.ext__label {
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.ext__input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--wb-ink);
  background: #fff;
}
.ext__input:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
/* 触发元素：只读展示（触发元素固定为打开弹窗时点击的那个元素） */
.ext__static {
  padding: 6px 8px;
  border: 1px dashed var(--wb-line);
  border-radius: 5px;
  font-size: 12.5px;
  color: var(--wb-ink2);
  background: #fbfcfe;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext__ghost {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
  text-align: left;
}
.ext__ghost:hover {
  border-color: var(--wb-primary);
  color: var(--wb-primary);
}
.ext__ghost--block {
  width: 100%;
  text-align: center;
  border-style: dashed;
}
.ext__switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
}
.ext__section {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--wb-line-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wb-ink3);
}
.ext__section-hint {
  margin-left: 8px;
  font-weight: 400;
  letter-spacing: 0;
  color: #b6bdcb;
}
.ext__params {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ext__param {
  display: grid;
  grid-template-columns: 140px 1fr 24px;
  gap: 6px;
  align-items: center;
}
.ext__del {
  border: none;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}
.ext__del:hover {
  color: var(--wb-danger);
}
.ext__resp {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--wb-line-soft);
  border-radius: 7px;
  background: #fbfcfe;
}
.ext__resp-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ext__resp-head .ext__del {
  margin-left: auto;
}
/* 标题栏问号图标：说明内容悬浮展示，避免说明正文把卡片撑高 */
.ext__help {
  position: relative;
  flex: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--wb-line);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  cursor: help;
}
.ext__help:hover::after {
  content: attr(data-tip);
  position: absolute;
  top: 20px;
  right: 0;
  z-index: 30;
  width: 250px;
  padding: 7px 9px;
  border-radius: 6px;
  background: #2b3242;
  color: #fff;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.7;
  text-align: left;
  white-space: pre-line;
  box-shadow: 0 6px 18px rgba(20, 26, 40, 0.2);
}
/* 目标元素 + 列表字段：两项各占一半宽度 */
.ext__resp-target {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  align-items: center;
}
.ext__resp-no {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--wb-ink3);
}
.ext__note {
  font-size: 11.5px;
  color: var(--wb-ink3);
  line-height: 1.7;
}
.ext__note code {
  font-family: var(--wb-mono);
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 3px;
  padding: 0 4px;
}
.ext__remove {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.ext__remove:hover {
  border-color: var(--wb-danger);
  color: var(--wb-danger);
}
.ext__spacer {
  flex: 1;
}
.ext__cancel,
.ext__ok {
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.ext__cancel {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: var(--wb-ink2);
}
.ext__ok {
  border: 1px solid var(--wb-primary);
  background: var(--wb-primary);
  color: #fff;
}
</style>
