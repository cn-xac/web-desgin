<script setup lang="ts">
/**
 * 外部数据源配置弹窗（rg4KCt）。
 *
 * 「通过按钮点击弹窗配置」—— 入口在属性面板的「外部数据源」按钮上，
 * 配置挂在当前节点（node.dataSource）：谁用它，谁决定参数选谁、结果写给谁。
 *
 * 配置项与待办一一对应：
 * - 请求方法 → 走 core 的统一请求层（拦截器 / 超时 / baseURL 全部生效）
 * - 触发长度 → 输入型元素输入到指定长度才发请求
 * - URL
 * - 请求参数映射 → 只能选当前页面的元素；子表单内元素也可选，整组子表单可作单值
 * - 响应数据映射 → 映射到某个元素；目标是选项类元素时按 value/label 映射成选项
 * - 只请求一次 → 页面级缓存
 * - 请求头 → 独立弹窗
 */
import { computed, reactive, watch } from "vue";
import type { ExternalDataSource } from "@x-ac/web-design-core";
import { collectBindableElements, findLocation, type Method } from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import { useExternalSourceDialog, useHeadersDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const dialog = useExternalSourceDialog();
const headersDialog = useHeadersDialog();
const notify = useNotify();

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface Draft {
  name: string;
  method: Method;
  url: string;
  headers: Record<string, string>;
  once: boolean;
  triggerLength: number;
  triggerPath: string;
  params: Array<{ key: string; path: string; label?: string }>;
  scopePath: string;
  listField: string;
  labelField: string;
  valueField: string;
  /** 响应目标是否为选项类元素（决定是否按 value/label 映射） */
  optionTarget: boolean;
}

const draft = reactive<Draft>({
  name: "",
  method: "GET",
  url: "",
  headers: {},
  once: true,
  triggerLength: 0,
  triggerPath: "",
  params: [],
  scopePath: "",
  listField: "",
  labelField: "label",
  valueField: "value",
  optionTarget: false,
});

const node = computed(() => {
  const target = dialog.target.value;
  if (!target) return undefined;
  return findLocation(store.page.children, target.nodeId)?.node;
});

/** 页面里可被映射的元素（只含表单控件与明细容器 —— 与「仅限当前页面选择元素」对齐） */
const elements = computed(() => collectBindableElements(store.page, { registry: catalog }));

const elementOptions = computed(() =>
  elements.value.map((item) => ({
    label: `${item.label}${item.isGroup ? "（整组）" : ""} · ${item.path}`,
    value: item.path,
  })),
);

/** 响应目标元素：按 scopePath 反查 */
const targetElement = computed(() => elements.value.find((item) => item.path === draft.scopePath));

const headerCount = computed(() => Object.keys(draft.headers).length);

function reset(): void {
  const source = node.value?.dataSource;
  Object.assign(draft, {
    name: source?.name ?? "",
    method: (source?.method ?? "GET") as Method,
    url: source?.url ?? "",
    headers: { ...(source?.headers ?? {}) },
    once: source?.once !== false,
    triggerLength: Number(source?.triggerLength ?? 0),
    triggerPath: source?.triggerPath ?? "",
    params: (source?.params ?? []).map((item) => ({ ...item })),
    scopePath: source?.response?.scopePath ?? "",
    listField: source?.response?.listField ?? "",
    labelField: source?.response?.labelField ?? "label",
    valueField: source?.response?.valueField ?? "value",
    optionTarget: false,
  } satisfies Draft);
  // 目标元素是选项类元素时，形态按选项走
  const found = elements.value.find((item) => item.path === draft.scopePath);
  draft.optionTarget = Boolean(found?.isOption);
}

watch(
  () => [dialog.visible.value, dialog.target.value?.nodeId] as const,
  ([visible]) => {
    if (visible) reset();
  },
  { immediate: true },
);

/** 选了响应目标 → 自动判定形态（选项类元素按 value/label 映射） */
function onTargetChange(path: string): void {
  draft.scopePath = path;
  const found = elements.value.find((item) => item.path === path);
  draft.optionTarget = Boolean(found?.isOption);
}

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
  const found = elements.value.find((el) => el.path === path);
  item.label = found?.label;
}

/* ---------------- 请求头 ---------------- */

async function openHeaders(): Promise<void> {
  const result = await headersDialog.open(draft.headers);
  // 取消时返回空对象：只在用户确实清空全部请求头时才覆盖
  if (Object.keys(result).length || !Object.keys(draft.headers).length) {
    draft.headers = result;
  }
}

/* ---------------- 保存 / 移除 ---------------- */

function buildSource(): ExternalDataSource {
  const source: ExternalDataSource = {
    method: draft.method,
    url: draft.url.trim(),
  };
  if (draft.name.trim()) source.name = draft.name.trim();
  if (Object.keys(draft.headers).length) source.headers = { ...draft.headers };
  const params = draft.params.filter((item) => item.key.trim() && item.path);
  if (params.length) source.params = params.map((item) => ({ key: item.key.trim(), path: item.path, label: item.label }));
  if (draft.scopePath.trim()) {
    source.response = {
      scopePath: draft.scopePath.trim(),
      shape: draft.optionTarget ? "select" : "form",
    };
    if (draft.listField.trim()) source.response.listField = draft.listField.trim();
    if (draft.optionTarget) {
      source.response.labelField = draft.labelField.trim() || "label";
      source.response.valueField = draft.valueField.trim() || "value";
    }
  }
  source.once = draft.once;
  if (draft.triggerLength > 0) {
    source.triggerLength = draft.triggerLength;
    if (draft.triggerPath) source.triggerPath = draft.triggerPath;
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
  const source = buildSource();
  store.setNodeDataSource(source);

  // 响应目标是选项类元素 → 把它的 options 绑到结果路径，
  // 运行时接口返回什么就是什么选项（取数与映射都归外部数据源管）
  const found = elements.value.find((item) => item.path === source.response?.scopePath);
  if (found?.isOption && source.response?.scopePath) {
    store.updateNodeProp(found.nodeId, "options", `{{${source.response.scopePath}}}`);
  }

  dialog.close();
  notify("外部数据源已保存", "success");
}

function remove(): void {
  const target = dialog.target.value;
  if (!target) return;
  const previousPath = node.value?.dataSource?.response?.scopePath;
  store.setNodeDataSource(undefined);
  // 顺带解除目标元素上指向该结果的 options 绑定，避免留下悬空引用
  if (previousPath) {
    const found = elements.value.find((item) => item.path === previousPath);
    if (found?.isOption) store.updateNodeProp(found.nodeId, "options", "");
  }
  dialog.close();
  notify("已移除外部数据源", "success");
}
</script>

<template>
  <ModalShell
    v-if="dialog.visible.value && dialog.target.value"
    :title="`外部数据源 · ${dialog.target.value.label}`"
    width="600px"
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
          <select v-model="draft.method" class="ext__input">
            <option v-for="item in METHODS" :key="item" :value="item">{{ item }}</option>
          </select>
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

      <!-- 触发 -->
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
          <label class="ext__label">触发字段</label>
          <select v-model="draft.triggerPath" class="ext__input">
            <option value="">（用元素自身的值）</option>
            <option v-for="item in elementOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
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
          <select
            class="ext__input"
            :value="item.path"
            @change="onParamElement(index, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">选择元素…</option>
            <option v-for="opt in elementOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button type="button" class="ext__del" title="删除" @click="removeParam(index)">×</button>
        </div>
        <button type="button" class="ext__ghost ext__ghost--block" @click="addParam">+ 添加参数</button>
      </div>

      <!-- 响应数据映射 -->
      <div class="ext__section">
        响应数据映射
        <span class="ext__section-hint">结果写入目标元素；目标是选项类元素时按「值 / 名称」映射成选项</span>
      </div>
      <div class="ext__row">
        <label class="ext__label">映射目标</label>
        <select class="ext__input" :value="draft.scopePath" @change="onTargetChange(($event.target as HTMLSelectElement).value)">
          <option value="">不映射（仅请求）</option>
          <option v-for="item in elementOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>

      <template v-if="draft.scopePath">
        <div class="ext__row">
          <label class="ext__label">写入路径</label>
          <input v-model="draft.scopePath" class="ext__input wb-mono" spellcheck="false" />
        </div>
        <div class="ext__row">
          <label class="ext__label">列表字段</label>
          <input v-model="draft.listField" class="ext__input wb-mono" placeholder="如 data.list（留空表示响应本身就是数组）" spellcheck="false" />
        </div>
        <div v-if="draft.optionTarget" class="ext__row ext__row--split">
          <div class="ext__cell">
            <label class="ext__label">值字段</label>
            <input v-model="draft.valueField" class="ext__input wb-mono" placeholder="value" spellcheck="false" />
          </div>
          <div class="ext__cell">
            <label class="ext__label">名称字段</label>
            <input v-model="draft.labelField" class="ext__input wb-mono" placeholder="label" spellcheck="false" />
          </div>
        </div>
        <div v-else class="ext__note">
          目标不是选项类元素，响应将整体写入
          <code>{{ targetElement?.label ?? draft.scopePath }}</code>
          的值。
        </div>
      </template>
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
