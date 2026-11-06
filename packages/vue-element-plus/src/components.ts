import type { Component } from "vue";
import { materialKey } from "@x-ac/design-core";
import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElDivider,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLink,
  ElRate,
  ElSlider,
  ElSpace,
  ElSwitch,
  ElTag,
} from "element-plus";
import BlockCard from "./blocks/BlockCard.vue";
import BlockTable from "./blocks/BlockTable.vue";
import BlockTitle from "./blocks/BlockTitle.vue";
import FieldAmount from "./fields/FieldAmount.vue";
import FieldCheckbox from "./fields/FieldCheckbox.vue";
import FieldDictSelect from "./fields/FieldDictSelect.vue";
import FieldOrgPicker from "./fields/FieldOrgPicker.vue";
import FieldRadio from "./fields/FieldRadio.vue";
import FieldSelect from "./fields/FieldSelect.vue";

/**
 * component 名 → Vue 组件。
 * 只在这里做映射，渲染器与设计器都不 import 具体组件，新增物料只改这张表。
 * 表里写裸名，对外键统一加 `ec-` 前缀（与 Schema 里的协议物料名一致）。
 * P1 会把这张表整体搬进 element-plus 适配包。
 */
const COMPONENT_TABLE: Record<string, Component | string> = {
  container: "div",
  grid: "div",
  space: ElSpace,
  card: BlockCard,
  title: BlockTitle,
  text: "p",
  divider: ElDivider,
  tag: ElTag,
  alert: ElAlert,
  image: ElImage,
  table: BlockTable,

  input: ElInput,
  textarea: ElInput,
  number: ElInputNumber,
  select: FieldSelect,
  radio: FieldRadio,
  checkbox: FieldCheckbox,
  switch: ElSwitch,
  date: ElDatePicker,
  rate: ElRate,
  slider: ElSlider,

  button: ElButton,
  link: ElLink,

  "org-picker": FieldOrgPicker,
  "dict-select": FieldDictSelect,
  "amount-input": FieldAmount,
};

export const COMPONENT_MAP: Record<string, Component | string> = Object.fromEntries(
  Object.entries(COMPONENT_TABLE).map(([key, component]) => [materialKey(key), component]),
);

export function resolveComponent(component: string): Component | string | null {
  return COMPONENT_MAP[materialKey(component)] ?? COMPONENT_TABLE[component] ?? null;
}
