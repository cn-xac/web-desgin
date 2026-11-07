import type { Component } from "vue";
import { materialKey } from "@x-ac/design-core";
import {
  ElAlert,
  ElButton,
  ElColorPicker,
  ElDatePicker,
  ElDivider,
  ElInput,
  ElInputNumber,
  ElLink,
  ElRate,
  ElSlider,
  ElSpace,
  ElSwitch,
  ElTag,
  ElTimePicker,
} from "element-plus";
import BlockAffix from "./blocks/BlockAffix.vue";
import BlockAnchor from "./blocks/BlockAnchor.vue";
import BlockAvatar from "./blocks/BlockAvatar.vue";
import BlockBadge from "./blocks/BlockBadge.vue";
import BlockBreadcrumb from "./blocks/BlockBreadcrumb.vue";
import BlockCalendar from "./blocks/BlockCalendar.vue";
import BlockCard from "./blocks/BlockCard.vue";
import BlockCarousel from "./blocks/BlockCarousel.vue";
import BlockCol from "./blocks/BlockCol.vue";
import BlockCollapse from "./blocks/BlockCollapse.vue";
import BlockDescriptions from "./blocks/BlockDescriptions.vue";
import BlockDialog from "./blocks/BlockDialog.vue";
import BlockDrawer from "./blocks/BlockDrawer.vue";
import BlockDropdown from "./blocks/BlockDropdown.vue";
import BlockEmpty from "./blocks/BlockEmpty.vue";
import BlockImage from "./blocks/BlockImage.vue";
import BlockMenu from "./blocks/BlockMenu.vue";
import BlockPagination from "./blocks/BlockPagination.vue";
import BlockPopconfirm from "./blocks/BlockPopconfirm.vue";
import BlockPopover from "./blocks/BlockPopover.vue";
import BlockProgress from "./blocks/BlockProgress.vue";
import BlockResult from "./blocks/BlockResult.vue";
import BlockRow from "./blocks/BlockRow.vue";
import BlockScrollbar from "./blocks/BlockScrollbar.vue";
import BlockSegmented from "./blocks/BlockSegmented.vue";
import BlockSkeleton from "./blocks/BlockSkeleton.vue";
import BlockStatistic from "./blocks/BlockStatistic.vue";
import BlockSteps from "./blocks/BlockSteps.vue";
import BlockTable from "./blocks/BlockTable.vue";
import BlockTabs from "./blocks/BlockTabs.vue";
import BlockText from "./blocks/BlockText.vue";
import BlockTimeline from "./blocks/BlockTimeline.vue";
import BlockTitle from "./blocks/BlockTitle.vue";
import BlockTooltip from "./blocks/BlockTooltip.vue";
import BlockWatermark from "./blocks/BlockWatermark.vue";
import FieldAmount from "./fields/FieldAmount.vue";
import FieldAutocomplete from "./fields/FieldAutocomplete.vue";
import FieldCascader from "./fields/FieldCascader.vue";
import FieldCheckbox from "./fields/FieldCheckbox.vue";
import FieldDictSelect from "./fields/FieldDictSelect.vue";
import FieldInputOtp from "./fields/FieldInputOtp.vue";
import FieldInputTag from "./fields/FieldInputTag.vue";
import FieldOrgPicker from "./fields/FieldOrgPicker.vue";
import FieldRadio from "./fields/FieldRadio.vue";
import FieldSelect from "./fields/FieldSelect.vue";
import FieldTransfer from "./fields/FieldTransfer.vue";
import FieldTreeSelect from "./fields/FieldTreeSelect.vue";
import FieldUpload from "./fields/FieldUpload.vue";

/**
 * component 名 → Vue 组件。
 * 只在这里做映射，渲染器与设计器都不 import 具体组件，新增物料只改这张表。
 * 表里写裸名，对外键统一加 `ec-` 前缀（与 Schema 里的协议物料名一致）。
 *
 * 「包装组件」与「直连 El*」的判据只有一条：
 * 组件的 props 能不能一对一喂给 El*。需要把扁平 props 翻译成子节点
 * （select 的 option、tabs 的 pane、菜单的 item）或翻译成别的 prop 形状
 * （image 的 preview → preview-src-list）时才包一层。
 */
const COMPONENT_TABLE: Record<string, Component | string> = {
  /* 布局 */
  container: "div",
  grid: "div",
  row: BlockRow,
  col: BlockCol,
  space: ElSpace,
  card: BlockCard,
  scrollbar: BlockScrollbar,
  affix: BlockAffix,
  collapse: BlockCollapse,
  tabs: BlockTabs,
  dialog: BlockDialog,
  drawer: BlockDrawer,
  watermark: BlockWatermark,

  /* 展示 */
  title: BlockTitle,
  text: BlockText,
  divider: ElDivider,
  tag: ElTag,
  alert: ElAlert,
  image: BlockImage,
  table: BlockTable,
  avatar: BlockAvatar,
  badge: BlockBadge,
  progress: BlockProgress,
  skeleton: BlockSkeleton,
  empty: BlockEmpty,
  statistic: BlockStatistic,
  segmented: BlockSegmented,
  descriptions: BlockDescriptions,
  timeline: BlockTimeline,
  carousel: BlockCarousel,
  result: BlockResult,
  calendar: BlockCalendar,
  tooltip: BlockTooltip,
  popover: BlockPopover,

  /* 导航 */
  breadcrumb: BlockBreadcrumb,
  menu: BlockMenu,
  steps: BlockSteps,
  dropdown: BlockDropdown,
  anchor: BlockAnchor,
  pagination: BlockPagination,

  /* 表单 */
  input: ElInput,
  textarea: ElInput,
  number: ElInputNumber,
  select: FieldSelect,
  radio: FieldRadio,
  checkbox: FieldCheckbox,
  switch: ElSwitch,
  date: ElDatePicker,
  "time-picker": ElTimePicker,
  rate: ElRate,
  slider: ElSlider,
  cascader: FieldCascader,
  "tree-select": FieldTreeSelect,
  transfer: FieldTransfer,
  upload: FieldUpload,
  autocomplete: FieldAutocomplete,
  "input-tag": FieldInputTag,
  "input-otp": FieldInputOtp,
  "color-picker": ElColorPicker,

  /* 交互 */
  button: ElButton,
  link: ElLink,
  popconfirm: BlockPopconfirm,

  /* 业务 */
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
