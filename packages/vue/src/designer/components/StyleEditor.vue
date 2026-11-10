<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import {
  emptySpacing,
  formatSpacing,
  normalizeLength,
  readSpacing,
  SPACING_PRESETS,
  SPACING_SIDES,
  type SpacingBox,
  type SpacingKey,
  type SpacingSide,
} from "@x-ac/web-design-core";
import { useDesignerStore } from "../store";
import UiControl from "../ui/UiControl.vue";

const store = useDesignerStore();
const node = computed(() => store.selectedNode);

interface StyleField {
  key: string;
  label: string;
  type: "text" | "color" | "select";
  placeholder?: string;
  options?: string[];
}

/** margin / padding 已由下面的间距编辑器接管，这里不再重复出现 */
const STYLE_FIELDS: StyleField[] = [
  { key: "width", label: "宽度", type: "text", placeholder: "如 100% / 320px" },
  { key: "background", label: "背景色", type: "color" },
  { key: "color", label: "文字色", type: "color" },
  { key: "fontSize", label: "字号", type: "text", placeholder: "如 14px" },
  { key: "textAlign", label: "对齐", type: "select", options: ["left", "center", "right"] },
  { key: "borderRadius", label: "圆角", type: "text", placeholder: "如 8px" },
];

const DIRECTIVES: Array<{ name: "show" | "if" | "for"; label: string; tip: string; placeholder: string }> = [
  { name: "show", label: "显示条件", tip: "不满足时渲染但隐藏，如 list.length > 0", placeholder: "list.length > 0" },
  { name: "if", label: "渲染条件", tip: "不满足时完全不渲染，适合有明显副作用的组件", placeholder: "form.type === 'a'" },
  { name: "for", label: "循环数据", tip: "绑定数组，子组件内用 item / index 访问", placeholder: "{{list}}" },
];

const SIDE_LABEL: Record<SpacingSide, string> = { top: "上", right: "右", bottom: "下", left: "左" };

/* ---------------- 间距 ---------------- */

type SpacingMode = "uniform" | "pair" | "free";

/** 三种编辑粒度：统一（1 个值）→ 绑定对（上下、左右各 1 个值）→ 分边（4 个值） */
const SPACING_MODES: Array<{ value: SpacingMode; label: string; title: string }> = [
  { value: "uniform", label: "统一", title: "四边用同一个值" },
  { value: "pair", label: "上下/左右", title: "上下绑定、左右绑定，共两个值" },
  { value: "free", label: "分边", title: "上 / 右 / 下 / 左 分别设置" },
];

/** 编辑模式：选中节点时按数据形态猜一次初始值，之后以用户点击为准（切换模式不改数据） */
const modes = reactive<Record<SpacingKey, SpacingMode>>({ margin: "uniform", padding: "uniform" });

const boxes = computed<Record<SpacingKey, SpacingBox>>(() => ({
  margin: readSpacing(node.value?.style, "margin").box,
  padding: readSpacing(node.value?.style, "padding").box,
}));

watch(
  () => node.value?.id,
  () => {
    for (const key of ["margin", "padding"] as SpacingKey[]) modes[key] = guessMode(key);
  },
  { immediate: true },
);

/** 按现有四边值猜初始模式：全等 → 统一；上下相等且左右相等 → 绑定对；其余 → 分边 */
function guessMode(key: SpacingKey): SpacingMode {
  const box = boxes.value[key];
  if (SPACING_SIDES.every((side) => box[side] === "")) return "uniform";
  if (SPACING_SIDES.every((side) => box[side] === box.top)) return "uniform";
  if (box.top === box.bottom && box.left === box.right) return "pair";
  return "free";
}

/** 统一模式下的输入值：四边一致时是单值，不一致时是简写（如 8px 12px） */
const linkedValue = computed<Record<SpacingKey, string>>(() => ({
  margin: formatSpacing(boxes.value.margin),
  padding: formatSpacing(boxes.value.padding),
}));

function setUniform(key: SpacingKey, value: string): void {
  const length = normalizeLength(value);
  store.updateSpacing(key, { top: length, right: length, bottom: length, left: length });
}

/** 绑定对编辑：axis = v 同时改上下，h 同时改左右 */
function setPair(key: SpacingKey, axis: "v" | "h", value: string): void {
  const length = normalizeLength(value);
  const box = boxes.value[key];
  const next: SpacingBox =
    axis === "v" ? { ...box, top: length, bottom: length } : { ...box, left: length, right: length };
  store.updateSpacing(key, next);
}

function setSide(key: SpacingKey, side: SpacingSide, value: string): void {
  const next: SpacingBox = { ...boxes.value[key], [side]: normalizeLength(value) };
  store.updateSpacing(key, next);
}

function clearSpacing(key: SpacingKey): void {
  store.updateSpacing(key, emptySpacing());
}

/** 快捷预设：scope 决定铺到哪 —— all 四边 / v 上下 / h 左右 */
function applyPreset(key: SpacingKey, px: number, scope: "all" | "v" | "h" = "all"): void {
  const value = px === 0 ? "0" : `${px}px`;
  if (scope === "v") return setPair(key, "v", value);
  if (scope === "h") return setPair(key, "h", value);
  setUniform(key, value);
}

/* ---------------- 其他 ---------------- */

function styleValue(key: string): string {
  const value = node.value?.style?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function directiveValue(name: "show" | "if" | "for"): string {
  return node.value?.directives?.find((item) => item.name === name)?.value ?? "";
}
</script>

<template>
  <div v-if="node" class="style">
    <div class="style__section">间距（所有组件通用）</div>

    <div v-for="key in (['margin', 'padding'] as SpacingKey[])" :key="key" class="box">
      <div class="box__head">
        <span class="box__title">{{ key === "margin" ? "外边距 Margin" : "内边距 Padding" }}</span>
        <div class="box__actions">
          <div class="box__modes">
            <button
              v-for="m in SPACING_MODES"
              :key="m.value"
              class="box__mode"
              :class="{ 'is-on': modes[key] === m.value }"
              :title="m.title"
              @click="modes[key] = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <button class="box__clear" title="清除" @click="clearSpacing(key)">清除</button>
        </div>
      </div>

      <!-- 统一：一个值铺四边 -->
      <div v-if="modes[key] === 'uniform'" class="box__single">
        <UiControl as="Input"
          size="small"
          :model-value="linkedValue[key]"
          placeholder="如 8 / 8px / auto"
          @update:model-value="(v: string) => setUniform(key, v)"
        />
      </div>

      <!-- 绑定对：上下一个值、左右一个值 -->
      <div v-else-if="modes[key] === 'pair'" class="box__pair">
        <label class="box__pair-row">
          <span>上下</span>
          <UiControl as="Input"
            size="small"
            :model-value="boxes[key].top"
            placeholder="如 8 / 8px"
            @update:model-value="(v: string) => setPair(key, 'v', v)"
          />
        </label>
        <label class="box__pair-row">
          <span>左右</span>
          <UiControl as="Input"
            size="small"
            :model-value="boxes[key].left"
            placeholder="如 12 / 12px"
            @update:model-value="(v: string) => setPair(key, 'h', v)"
          />
        </label>
      </div>

      <!-- 分边：上 / 右 / 下 / 左 各自设置 -->
      <div v-else class="box__grid">
        <label v-for="side in SPACING_SIDES" :key="side" class="box__cell">
          <span>{{ SIDE_LABEL[side] }}</span>
          <UiControl as="Input"
            size="small"
            :model-value="boxes[key][side]"
            placeholder="0"
            @update:model-value="(v: string) => setSide(key, side, v)"
          />
        </label>
      </div>

      <div class="box__presets">
        <!-- 绑定对模式：上下、左右各一排预设 -->
        <template v-if="modes[key] === 'pair'">
          <div v-for="axis in (['v', 'h'] as const)" :key="axis" class="box__preset-row">
            <span>{{ axis === "v" ? "上下" : "左右" }}</span>
            <button
              v-for="px in SPACING_PRESETS"
              :key="`${key}-${axis}-${px}`"
              class="box__preset"
              :title="`${px}px`"
              @click="applyPreset(key, px, axis)"
            >
              {{ px }}
            </button>
          </div>
        </template>
        <!-- 其余模式：一排预设铺四边 -->
        <div v-else class="box__preset-row">
          <span>全部</span>
          <button
            v-for="px in SPACING_PRESETS"
            :key="`${key}-${px}`"
            class="box__preset"
            :title="`${px}px`"
            @click="applyPreset(key, px)"
          >
            {{ px }}
          </button>
        </div>
      </div>
    </div>

    <div class="style__tip-line">
      写入节点 <code>style</code>，导出的 JSON 在 Vue / React / 原生 HTML 中都是同一套 CSS。
    </div>

    <div class="style__section">内联样式</div>
    <div v-for="field in STYLE_FIELDS" :key="field.key" class="style__row">
      <label>{{ field.label }}</label>
      <UiControl as="ColorInput"
        v-if="field.type === 'color'"
        :model-value="styleValue(field.key)"
        size="small"
        show-alpha
        @update:model-value="(v: string | null) => store.updateStyle(field.key, v ?? '')"
      />
      <UiControl
        v-else-if="field.type === 'select'"
        as="Select"
        :model-value="styleValue(field.key)"
        :options="(field.options ?? []).map((option) => ({ label: option, value: option }))"
        size="small"
        clearable
        placeholder="默认"
        @update:model-value="(v: string) => store.updateStyle(field.key, v ?? '')"
      />
      <UiControl as="Input"
        v-else
        size="small"
        :model-value="styleValue(field.key)"
        :placeholder="field.placeholder"
        @update:model-value="(v: string) => store.updateStyle(field.key, v)"
      />
    </div>

    <div class="style__section">显示与循环</div>
    <div v-for="directive in DIRECTIVES" :key="directive.name" class="style__row style__row--block">
      <label>{{ directive.label }}</label>
      <UiControl as="Input"
        size="small"
        :model-value="directiveValue(directive.name)"
        :placeholder="directive.placeholder"
        @update:model-value="(v: string) => store.setDirective(directive.name, v)"
      />
      <div class="style__tip">{{ directive.tip }}</div>
    </div>

    <div class="style__section">预览元素</div>
    <pre class="style__preview">{{ JSON.stringify({ style: node.style ?? {}, directives: node.directives ?? [] }, null, 2) }}</pre>
  </div>
</template>

<style scoped>
.style {
  padding: 14px;
}
.style__section {
  margin: 16px 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--wb-ink3);
}
.style__section:first-child {
  margin-top: 0;
}
.style__row {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.style__row--block {
  grid-template-columns: 64px 1fr;
  align-items: start;
}
.style__row label {
  font-size: 12px;
  color: var(--wb-ink2);
}
.style__tip {
  grid-column: 2;
  font-size: 11px;
  color: var(--wb-ink3);
  line-height: 1.5;
  margin-top: -4px;
}
.style__tip-line {
  font-size: 11px;
  line-height: 1.6;
  color: var(--wb-ink3);
}
.style__tip-line code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--wb-bg);
  font-family: var(--wb-mono);
}
.style__preview {
  margin: 0;
  padding: 10px;
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  border-radius: 6px;
  font-family: var(--wb-mono);
  font-size: 11px;
  color: #334;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ---------------- 间距编辑器 ---------------- */
.box {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--wb-line-soft);
  border-radius: 8px;
  background: #fcfcfe;
}
.box__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.box__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink2);
}
.box__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.box__modes {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: 4px;
}
.box__mode {
  padding: 2px 7px;
  border: none;
  border-right: 1px solid var(--wb-line-soft);
  background: #fff;
  color: var(--wb-ink3);
  font-size: 11px;
  cursor: pointer;
  line-height: 16px;
  white-space: nowrap;
}
.box__mode:last-child {
  border-right: none;
}
.box__mode.is-on {
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
  font-weight: 600;
}
.box__mode:hover {
  color: var(--wb-primary);
}
.box__clear {
  padding: 2px 6px;
  border: 1px solid var(--wb-line);
  border-radius: 4px;
  background: #fff;
  color: var(--wb-ink3);
  font-size: 11px;
  cursor: pointer;
  line-height: 16px;
}
.box__clear:hover {
  border-color: var(--wb-primary);
  color: var(--wb-primary);
}
.box__single {
  display: grid;
  grid-template-columns: 30px 1fr;
  align-items: center;
  gap: 6px;
}
.box__single::before {
  content: "四边";
  font-size: 11px;
  color: var(--wb-ink3);
}
.box__pair {
  display: grid;
  gap: 6px;
}
.box__pair-row {
  display: grid;
  grid-template-columns: 30px 1fr;
  align-items: center;
  gap: 6px;
}
.box__pair-row > span {
  font-size: 11px;
  color: var(--wb-ink3);
}
.box__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.box__cell {
  display: grid;
  grid-template-columns: 18px 1fr;
  align-items: center;
  gap: 4px;
}
.box__cell span {
  font-size: 11px;
  color: var(--wb-ink3);
  text-align: center;
}
.box__presets {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}
.box__preset-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.box__preset-row > span {
  flex: 0 0 30px;
  font-size: 11px;
  color: var(--wb-ink3);
}
.box__preset {
  flex: 1;
  padding: 2px 0;
  border: 1px solid var(--wb-line-soft);
  border-radius: 4px;
  background: #fff;
  color: var(--wb-ink3);
  font-size: 11px;
  cursor: pointer;
}
.box__preset:hover {
  border-color: var(--wb-primary);
  color: var(--wb-primary);
}
</style>
