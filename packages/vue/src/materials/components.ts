import type { Component } from "vue";
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
 */
export const COMPONENT_MAP: Record<string, Component | string> = {
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

export function resolveComponent(component: string): Component | string | null {
  return COMPONENT_MAP[component] ?? null;
}
