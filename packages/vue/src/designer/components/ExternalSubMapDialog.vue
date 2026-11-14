<script setup lang="ts">
/**
 * 子映射弹窗（#4）。
 *
 * 响应目标是子表单时，主映射里给出「父字段名」（明细数组所在的字段），
 * 子映射只需要填「父字段里的子字段」：
 * - 左侧是子表单里已经有的字段（只读，来自 Schema）；
 * - 右侧填这一项在响应数据里对应的字段名，留空表示不映射。
 *
 * 运行时，响应数组的每一行都会按这些映射填成一条明细对象。
 */
import { computed, reactive, watch } from "vue";
import type { ExternalSubMap } from "@x-ac/web-design-core";
import { collectSubFormFields } from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import { useMaterialCatalog } from "../../materials/catalog";
import { useSubMapDialog } from "../dialogs";
import ModalShell from "../ui/ModalShell.vue";

const store = useDesignerStore();
const catalog = useMaterialCatalog();
const dialog = useSubMapDialog();

/** 子表单里的字段（左侧只读列） */
const fields = computed(() => {
  const target = dialog.target.value;
  if (!target) return [];
  return collectSubFormFields(store.page, target.groupNodeId, { registry: catalog });
});

/** 草稿：每行 = 子表单字段 + 响应字段名 */
const rows = reactive<Array<{ field: string; label: string; from: string }>>([]);

watch(
  () => [dialog.visible.value, dialog.target.value?.groupNodeId] as const,
  ([visible]) => {
    if (!visible) return;
    const target = dialog.target.value;
    if (!target) return;
    const previous = new Map(target.maps.map((item) => [item.field, item.from]));
    rows.splice(
      0,
      rows.length,
      ...fields.value.map((item) => ({
        field: item.field,
        label: item.label,
        from: previous.get(item.field) ?? "",
      })),
    );
  },
  { immediate: true },
);

function save(): void {
  const maps: ExternalSubMap[] = rows
    .filter((row) => row.from.trim())
    .map((row) => ({ field: row.field, from: row.from.trim() }));
  dialog.confirm(maps);
}
</script>

<template>
  <ModalShell
    v-if="dialog.visible.value && dialog.target.value"
    :title="`子映射 · ${dialog.target.value.label}`"
    width="560px"
    @close="dialog.cancel()"
  >
    <div class="sub">
      <!-- 说明项：让人一眼看懂怎么填 -->
      <div class="sub__tip">
        <span class="sub__tip-icon" title="子映射怎么用">?</span>
        <div class="sub__tip-body">
          <b>子映射</b>：响应数组的<b>每一行</b>会填成子表单的一条明细。<br />
          左侧是子表单里已有的字段，右侧填这一项在响应数据里对应的<b>字段名</b>（留空 = 不映射）。<br />
          父字段名 <code>{{ dialog.target.value.parentField }}</code> 已在主映射里设置，这里只填它的子字段。
        </div>
      </div>

      <div class="sub__head">
        <span class="sub__col sub__col--field">子表单字段</span>
        <span class="sub__col sub__col--from">响应数据字段</span>
      </div>

      <div class="sub__rows">
        <div v-for="(row, index) in rows" :key="row.field" class="sub__row">
          <div class="sub__col sub__col--field">
            <span class="sub__label">{{ row.label }}</span>
            <code class="sub__code">{{ row.field }}</code>
          </div>
          <input
            v-model="rows[index].from"
            class="sub__input wb-mono"
            placeholder="如 goodsName（留空 = 不映射）"
            spellcheck="false"
          />
        </div>
        <div v-if="!rows.length" class="sub__empty">
          该子表单里还没有可映射的字段，先在子表单内添加表单控件。
        </div>
      </div>
    </div>

    <template #footer>
      <span class="sub__spacer" />
      <button type="button" class="sub__cancel" @click="dialog.cancel()">取消</button>
      <button type="button" class="sub__ok" @click="save">确定</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.sub {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sub__tip {
  display: flex;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #dbe4ff;
  border-radius: 7px;
  background: #f5f8ff;
}
.sub__tip-icon {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  cursor: help;
}
.sub__tip-body {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--wb-ink2);
}
.sub__tip-body code {
  font-family: var(--wb-mono);
  background: #fff;
  border: 1px solid var(--wb-line-soft);
  border-radius: 3px;
  padding: 0 4px;
}
.sub__head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--wb-ink3);
}
.sub__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow: auto;
}
.sub__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: center;
}
.sub__col--field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sub__label {
  font-size: 12.5px;
  color: var(--wb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub__code {
  font-family: var(--wb-mono);
  font-size: 11px;
  color: var(--wb-ink3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub__input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--wb-ink);
  background: #fff;
}
.sub__input:focus {
  outline: none;
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 3px rgba(47, 75, 255, 0.1);
}
.sub__empty {
  padding: 14px;
  border: 1px dashed var(--wb-line);
  border-radius: 6px;
  text-align: center;
  font-size: 12px;
  color: var(--wb-ink3);
}
.sub__spacer {
  flex: 1;
}
.sub__cancel,
.sub__ok {
  border-radius: 5px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.sub__cancel {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: var(--wb-ink2);
}
.sub__ok {
  border: 1px solid var(--wb-primary);
  background: var(--wb-primary);
  color: #fff;
}
</style>
