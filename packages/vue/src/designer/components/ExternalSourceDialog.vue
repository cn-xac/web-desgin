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
import type { DataShape, ExternalDataSource, ExternalResponseMap } from "@x-ac/web-design-core";
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
import { useExternalSourceDialog, useHeadersDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const dialog = useExternalSourceDialog();
const headersDialog = useHeadersDialog();
const notify = useNotify();

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_OPTIONS = METHODS.map((m) => ({ label: m, value: m }));

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
  draft.responses.push({
    targetNodeId: "",
    scopePath: defaultScopePath(),
    listField: "",
    labelField: "",
    valueField: "",
    shape: "form",
  });
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
  }
}

/* ---------------- 请求头 ---------------- */

async function openHeaders(): Promise<void> {
  const result = await headersDialog.open(draft.headers);
  if (Object.keys(result).length || !Object.keys(draft.headers).length) {
    draft.headers = result;
  }
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
            <button type="button" class="ext__del" title="删除映射" @click="removeResponse(index)">×</button>
          </div>
          <div class="ext__param">
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
          </div>
          <div class="ext__row">
            <label class="ext__label">写入路径</label>
            <input v-model="resp.scopePath" class="ext__input wb-mono" placeholder="如 external.deptList" spellcheck="false" />
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
          <div v-else-if="!resp.targetNodeId" class="ext__note">
            未选目标元素：结果整体写入 <code>{{ resp.scopePath }}</code>，由你自行把某元素属性绑到该路径。
          </div>
          <div v-else class="ext__note">
            目标不是选项类元素，响应将整体写入 <code>{{ resp.scopePath }}</code> 的值。
          </div>
          <div class="ext__row">
            <label class="ext__label">列表字段</label>
            <input v-model="resp.listField" class="ext__input wb-mono" placeholder="如 data.list（留空表示响应本身就是数组）" spellcheck="false" />
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
  grid-template-columns: 140px 1fr;
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
  justify-content: space-between;
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
