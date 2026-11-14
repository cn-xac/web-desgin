<script setup lang="ts">
/**
 * 请求头设置弹窗（独立弹窗）。
 *
 * 请求头是「另一类」配置：条目多、几乎不改、且改错了很难一眼看出来。
 * 塞进外部数据源主弹窗会把主弹窗撑成一坨，所以单独拆一个弹窗，
 * 主弹窗只留一个「请求头（N）」按钮 + 计数。
 *
 * 行以数组形式保存：空名称的行在编辑期间必须留着，
 * 否则用户刚添加的那一行会被下一次编辑挤掉；空行在「确定」时才过滤。
 */
import { useHeadersDialog } from "../dialogs";
import ModalShell from "../ui/ModalShell.vue";

const dialog = useHeadersDialog();

function add(): void {
  dialog.rows.value.push({ key: "", value: "" });
}

function remove(index: number): void {
  dialog.rows.value.splice(index, 1);
}

function confirm(): void {
  dialog.confirm(dialog.rows.value.map((row) => ({ key: row.key, value: row.value })));
}
</script>

<template>
  <ModalShell v-if="dialog.visible.value" title="请求头" width="460px" @close="dialog.cancel()">
    <div class="hdr__hint">逐条填写请求头名称与取值，名称不能为空。</div>

    <div class="hdr__rows">
      <div v-for="(row, index) in dialog.rows.value" :key="index" class="hdr__row">
        <input
          v-model="row.key"
          class="hdr__input wb-mono"
          placeholder="名称，如 Authorization"
          spellcheck="false"
        />
        <input
          v-model="row.value"
          class="hdr__input wb-mono"
          placeholder="取值"
          spellcheck="false"
        />
        <button type="button" class="hdr__del" title="删除" @click="remove(index)">×</button>
      </div>
      <div v-if="!dialog.rows.value.length" class="hdr__empty">还没有请求头</div>
    </div>

    <button type="button" class="hdr__add" @click="add">+ 添加请求头</button>

    <template #footer>
      <button type="button" class="hdr__cancel" @click="dialog.cancel()">取消</button>
      <button type="button" class="hdr__ok" @click="confirm">确定</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.hdr__hint {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--wb-ink2);
}
.hdr__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.hdr__row {
  display: grid;
  grid-template-columns: 1fr 1fr 24px;
  gap: 6px;
  align-items: center;
}
.hdr__input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  font-size: 12px;
  color: var(--wb-ink);
}
.hdr__input:focus {
  outline: none;
  border-color: var(--wb-primary);
}
.hdr__del {
  border: none;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}
.hdr__del:hover {
  color: var(--wb-danger);
}
.hdr__empty {
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.hdr__add {
  border: 1px dashed var(--wb-line);
  border-radius: 5px;
  background: #fff;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--wb-primary);
  cursor: pointer;
}
.hdr__cancel,
.hdr__ok {
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.hdr__cancel {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: var(--wb-ink2);
}
.hdr__ok {
  border: 1px solid var(--wb-primary);
  background: var(--wb-primary);
  color: #fff;
}
</style>
