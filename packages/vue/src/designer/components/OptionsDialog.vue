<script setup lang="ts">
/**
 * 选项录入弹窗（rSulo9 / 本次增强）。
 *
 * 两种选项来源互斥呈现：
 * 1. 手工录入：一行一个「名称 值」，存进 Schema 的多行文本（原行为）；
 * 2. 选项数据源（#5）：从接口取选项，只需配置 label / value 映射——
 *    label 必填，value 留空则运行时默认等于 label。配置后 options 自动绑到结果路径。
 *
 * 选项数据源本质就是节点上的 `dataSource`（asOptions: true，单个 select 形态响应），
 * 与「外部数据源」共用同一套运行时；这里只是给它一个更省心的录入入口。
 */
import { computed, reactive, ref, watch } from "vue";
import type { ExternalDataSource, ExternalResponseMap, Method } from "@x-ac/web-design-core";
import {
  collectBindableElements,
  findLocation,
  parseOptionLines,
  responsesOf,
  toOptionLines,
  type BindableElement,
} from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import { useOptionsDialog, useExternalSourceDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const dialog = useOptionsDialog();
const externalDialog = useExternalSourceDialog();
const notify = useNotify();

const text = ref("");
const optOn = ref(false);

interface OptParam {
  key: string;
  path: string;
  label?: string;
}
const optDraft = reactive({
  url: "",
  method: "GET" as Method,
  params: [] as OptParam[],
  listField: "",
  labelField: "label",
  valueField: "",
  once: true,
});

/** 目标节点：弹窗打开期间选中项可能被改，按 nodeId 取，别跟着选中项漂 */
const node = computed(() => {
  const target = dialog.target.value;
  if (!target) return undefined;
  return findLocation(store.page.children, target.nodeId)?.node;
});

/** 参数可选元素（表单控件，#1 的参数仍只取有值的元素） */
const elements = computed(() => collectBindableElements(store.page, { registry: catalog }));
const elementOptions = computed(() =>
  elements.value.map((item: BindableElement) => ({
    label: `${item.label}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.path,
  })),
);

/** 已配置的「选项数据源」信息（用于展示已启用状态） */
const preview = computed(() => parseOptionLines(text.value));

function defaultOpt(): void {
  Object.assign(optDraft, {
    url: "",
    method: "GET" as Method,
    params: [],
    listField: "",
    labelField: "label",
    valueField: "",
    once: true,
  });
}

function load(): void {
  text.value = toOptionLines(node.value?.props?.options);

  const source = node.value?.dataSource;
  const enabled = Boolean(source?.url && source.asOptions && responsesOf(source)[0]);
  optOn.value = enabled;
  if (enabled && source) {
    const resp = responsesOf(source)[0]!;
    Object.assign(optDraft, {
      url: source.url,
      method: (source.method ?? "GET") as Method,
      params: (source.params ?? []).map((i) => ({ ...i })),
      listField: resp.listField ?? "",
      labelField: resp.labelField ?? "label",
      valueField: resp.valueField ?? "",
      once: source.once !== false,
    });
  } else {
    defaultOpt();
  }
}

watch(
  () => [dialog.visible.value, dialog.target.value?.nodeId] as const,
  ([visible]) => {
    if (visible) load();
  },
  { immediate: true },
);

function addParam(): void {
  optDraft.params.push({ key: "", path: "" });
}
function removeParam(index: number): void {
  optDraft.params.splice(index, 1);
}
function onParamElement(index: number, path: string): void {
  const item = optDraft.params[index];
  if (!item) return;
  item.path = path;
  item.label = elements.value.find((el) => el.path === path)?.label;
}

/* ---------------- 保存 ---------------- */

function save(): void {
  const target = dialog.target.value;
  if (!target) return;

  // 选项数据源模式
  if (optOn.value) {
    if (!optDraft.url.trim()) {
      notify("请填写请求地址", "error");
      return;
    }
    if (!optDraft.labelField.trim()) {
      notify("请填写名称字段（label 必填）", "error");
      return;
    }
    const nodeId = node.value?.id;
    if (!nodeId) return;
    const scopePath = `options.${nodeId}`;
    const source: ExternalDataSource = {
      url: optDraft.url.trim(),
      method: optDraft.method,
      once: optDraft.once,
      asOptions: true,
      params: optDraft.params
        .filter((i) => i.key.trim() && i.path)
        .map((i) => ({ key: i.key.trim(), path: i.path, label: i.label })),
      responses: [
        {
          scopePath,
          shape: "select",
          labelField: optDraft.labelField.trim(),
          valueField: optDraft.valueField.trim(),
        } as ExternalResponseMap,
      ],
    };
    store.setNodeDataSource(source);
    store.updateNodeProp(nodeId, "options", `{{${scopePath}}}`);
    dialog.close();
    notify("选项数据源已保存", "success");
    return;
  }

  // 关闭选项数据源：若之前是 asOptions 源，清掉以免遗留
  if (node.value?.dataSource?.asOptions) {
    store.setNodeDataSource(undefined);
  }
  store.updateProp(target.key, text.value);
  dialog.close();
  notify("选项已更新", "success");
}

function clear(): void {
  const target = dialog.target.value;
  if (!target) return;
  if (optOn.value) return;
  store.updateProp(target.key, "");
  dialog.close();
}

function openExternal(): void {
  const target = dialog.target.value;
  if (!target) return;
  dialog.close();
  externalDialog.open({ nodeId: target.nodeId, label: target.label });
}
</script>

<template>
  <ModalShell
    v-if="dialog.visible.value && dialog.target.value"
    :title="`编辑${dialog.target.value.label}`"
    width="560px"
    @close="dialog.close()"
  >
    <!-- 选项数据源开关（#5） -->
    <div class="opts__source">
      <label class="opts__source-switch">
        <input v-model="optOn" type="checkbox" />
        <span>使用选项数据源（从接口取选项）</span>
      </label>
    </div>

    <!-- 选项数据源配置 -->
    <div v-if="optOn" class="opts__source-conf">
      <div class="opts__row">
        <label class="opts__label">请求方法</label>
        <UiControl as="Select" v-model="optDraft.method" :options="[
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
        ]" size="small" />
      </div>
      <div class="opts__row">
        <label class="opts__label">请求地址</label>
        <input v-model="optDraft.url" class="opts__input wb-mono" placeholder="/api/dict/list" spellcheck="false" />
      </div>

      <div class="opts__section">请求参数（可选，来自页面元素）</div>
      <div class="opts__params">
        <div v-for="(item, index) in optDraft.params" :key="index" class="opts__param">
          <input v-model="item.key" class="opts__input" placeholder="参数名" spellcheck="false" />
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
          <button type="button" class="opts__del" title="删除" @click="removeParam(index)">×</button>
        </div>
        <button type="button" class="opts__ghost--block" @click="addParam">+ 添加参数</button>
      </div>

      <div class="opts__row">
        <label class="opts__label">列表字段</label>
        <input v-model="optDraft.listField" class="opts__input wb-mono" placeholder="如 data.list（留空=响应本身即数组）" spellcheck="false" />
      </div>
      <div class="opts__row opts__row--split">
        <div class="opts__cell">
          <label class="opts__label">名称字段 <em class="opts__req">*</em></label>
          <input v-model="optDraft.labelField" class="opts__input wb-mono" placeholder="label" spellcheck="false" />
        </div>
        <div class="opts__cell">
          <label class="opts__label">值字段</label>
          <input v-model="optDraft.valueField" class="opts__input wb-mono" placeholder="留空 = 用名称" spellcheck="false" />
        </div>
      </div>
      <label class="opts__switch">
        <input v-model="optDraft.once" type="checkbox" />
        <span>只请求一次</span>
      </label>
      <div class="opts__tip">
        运行时由接口返回并映射为选项的「名称 / 值」；未设值字段时值默认等于名称。结果写入
        <code>options.{{ node?.id }}</code>，本元素的 options 已自动绑定。
      </div>
      <button type="button" class="opts__adv" @click="openExternal">
        需要多条响应 / 缓存策略等高级配置？打开「外部数据源」 →
      </button>
    </div>

    <!-- 手工录入 -->
    <template v-else>
      <div class="opts__hint">
        每行一个选项，<b>名称在前、值在后</b>，中间用空格隔开（多个空格也行）。<br />
        只写名称时，值与名称相同。示例：<code>技术中心&nbsp;&nbsp;tech</code>
      </div>

      <textarea
        v-model="text"
        class="opts__text wb-mono"
        rows="9"
        spellcheck="false"
        placeholder="技术中心  tech&#10;产品中心  product"
      />

      <div class="opts__preview-head">
        <span>解析结果</span>
        <span class="opts__count">{{ preview.length }} 项</span>
      </div>
      <div class="opts__preview wb-scroll">
        <div v-if="!preview.length" class="opts__preview-empty">还没有选项</div>
        <div v-for="(item, index) in preview" :key="index" class="opts__preview-row">
          <span class="opts__preview-label">{{ item.label }}</span>
          <span class="opts__preview-arrow">→</span>
          <span class="opts__preview-value">{{ item.value }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <button v-if="!optOn" type="button" class="opts__clear" @click="clear">清空</button>
      <span class="opts__spacer" />
      <button type="button" class="opts__cancel" @click="dialog.close()">取消</button>
      <button type="button" class="opts__ok" @click="save">确定</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.opts__source {
  margin-bottom: 10px;
}
.opts__source-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
}
.opts__source-conf {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opts__row {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: 10px;
}
.opts__row--split {
  grid-template-columns: 1fr 1fr;
}
.opts__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.opts__label {
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.opts__req {
  color: var(--wb-danger);
  font-style: normal;
}
.opts__input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--wb-ink);
  background: #fff;
}
.opts__input:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
.opts__section {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--wb-line-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wb-ink3);
}
.opts__params {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opts__param {
  display: grid;
  grid-template-columns: 130px 1fr 24px;
  gap: 6px;
  align-items: center;
}
.opts__ghost--block {
  width: 100%;
  text-align: center;
  border: 1px dashed var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.opts__ghost--block:hover {
  border-color: var(--wb-primary);
  color: var(--wb-primary);
}
.opts__del {
  border: none;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}
.opts__del:hover {
  color: var(--wb-danger);
}
.opts__switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wb-ink2);
  cursor: pointer;
}
.opts__tip {
  font-size: 11.5px;
  color: var(--wb-ink3);
  line-height: 1.7;
}
.opts__tip code {
  font-family: var(--wb-mono);
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 3px;
  padding: 0 4px;
}
.opts__adv {
  border: none;
  background: transparent;
  padding: 2px 0;
  font-size: 11.5px;
  color: var(--wb-primary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.opts__adv:hover {
  text-decoration: underline;
}
.opts__hint {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--wb-ink2);
  line-height: 1.7;
}
.opts__hint code,
.opts__external-tip code {
  font-family: var(--wb-mono);
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 3px;
  padding: 0 4px;
}
.opts__text {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--wb-line);
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--wb-ink);
  resize: vertical;
}
.opts__text:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
.opts__preview-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wb-ink3);
}
.opts__count {
  font-weight: 400;
  letter-spacing: 0;
}
.opts__preview {
  max-height: 168px;
  border: 1px solid var(--wb-line-soft);
  border-radius: 8px;
  padding: 6px;
  background: #fbfcfe;
}
.opts__preview-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.opts__preview-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 6px;
  font-size: 12px;
}
.opts__preview-row:nth-child(odd) {
  background: #fff;
  border-radius: 4px;
}
.opts__preview-label {
  color: var(--wb-ink);
  font-weight: 600;
}
.opts__preview-arrow {
  color: var(--wb-ink3);
  font-size: 11px;
}
.opts__preview-value {
  font-family: var(--wb-mono);
  font-size: 11.5px;
  color: var(--wb-primary);
}
.opts__clear {
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-ink2);
  cursor: pointer;
}
.opts__clear:hover {
  border-color: var(--wb-danger);
  color: var(--wb-danger);
}
.opts__spacer {
  flex: 1;
}
.opts__cancel,
.opts__ok {
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.opts__cancel {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: var(--wb-ink2);
}
.opts__ok {
  border: 1px solid var(--wb-primary);
  background: var(--wb-primary);
  color: #fff;
}
</style>
