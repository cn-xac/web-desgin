<script setup lang="ts">
/**
 * 选项录入弹窗（rSulo9）。
 *
 * 录入形态：一行一个选项，名称(label)在前、值(value)在后，以空格（支持多个空格）隔开。
 * 存进 Schema 的就是这段多行文本 —— 可读、可 diff、可手写，
 * 解析规则由 core 的 parseOptionLines 统一提供（渲染器与设计器共用）。
 *
 * 与外部数据源的关系：当节点配了外部数据源、且响应结果映射到本元素时，
 * 选项由接口返回，弹窗只读展示，不再手填 —— 取数与 label/value 映射都归 rg4KCt 管。
 */
import { computed, ref, watch } from "vue";
import { findLocation, parseOptionLines, toOptionLines } from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useOptionsDialog, useExternalSourceDialog } from "../dialogs";
import { useNotify } from "../ui/kit";
import ModalShell from "../ui/ModalShell.vue";

const store = useDesignerStore();
const dialog = useOptionsDialog();
const externalDialog = useExternalSourceDialog();
const notify = useNotify();

const text = ref("");

/** 目标节点：弹窗打开期间选中项可能被改，按 nodeId 取，别跟着选中项漂 */
const node = computed(() => {
  const target = dialog.target.value;
  if (!target) return undefined;
  return findLocation(store.page.children, target.nodeId)?.node;
});

/**
 * 外部数据源是否接管了本元素的选项：
 * 节点配了外部数据源，且响应结果的 scopePath 正是 options 绑定的那个路径。
 */
const external = computed(() => {
  const source = node.value?.dataSource;
  const scopePath = source?.response?.scopePath;
  if (!source?.url || !scopePath) return null;
  const bound = String(node.value?.props?.options ?? "").trim();
  const expected = `{{${scopePath}}}`;
  if (bound !== expected) return null;
  return { source, scopePath };
});

const preview = computed(() => parseOptionLines(text.value));

function load(): void {
  text.value = toOptionLines(node.value?.props?.options);
}

watch(
  () => [dialog.visible.value, dialog.target.value?.nodeId] as const,
  ([visible]) => {
    if (visible) load();
  },
  { immediate: true },
);

function save(): void {
  const target = dialog.target.value;
  if (!target || external.value) return;
  store.updateProp(target.key, text.value);
  dialog.close();
  notify("选项已更新", "success");
}

function clear(): void {
  const target = dialog.target.value;
  if (!target || external.value) return;
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
    <div v-if="external" class="opts__external">
      <div class="opts__external-title">
        选项由外部数据源提供
        <span class="opts__external-name">{{ external.source.name || external.source.url }}</span>
      </div>
      <div class="opts__external-tip">
        运行时由接口返回并映射为选项的「名称 / 值」，此处不再手工录入。
        结果写入路径：<code>{{ external.scopePath }}</code>
      </div>
      <button type="button" class="opts__external-btn" @click="openExternal">查看 / 修改外部数据源配置</button>
    </div>

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
      <button v-if="!external" type="button" class="opts__clear" @click="clear">清空</button>
      <span class="opts__spacer" />
      <button type="button" class="opts__cancel" @click="dialog.close()">取消</button>
      <button v-if="!external" type="button" class="opts__ok" @click="save">确定</button>
    </template>
  </ModalShell>
</template>

<style scoped>
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
.opts__external {
  padding: 14px;
  border: 1px solid #dfe4ff;
  border-radius: 8px;
  background: var(--wb-primary-soft);
}
.opts__external-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink);
}
.opts__external-name {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--wb-primary);
}
.opts__external-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--wb-ink2);
  line-height: 1.7;
}
.opts__external-btn {
  margin-top: 10px;
  border: 1px solid var(--wb-primary);
  border-radius: 5px;
  background: #fff;
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-primary);
  cursor: pointer;
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
