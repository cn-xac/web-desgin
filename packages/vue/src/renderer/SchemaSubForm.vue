<script setup lang="ts">
/**
 * 子表单（明细数组容器）。
 *
 * - 数据呈数组：`form.<itemPath>` = [{...}, {...}]，itemPath 相对父级绑定前缀；
 * - 可「添加 / 删除 / 上移 / 下移」每组，满足明细类数据提交（订单项、家庭成员等）；
 * - 组内字段按「当前组路径.组件ID」自动绑定，因此天然支持子表单无限嵌套；
 * - 设计态只渲染一个可编辑模板组，增删仅调整本地预览组数，不污染真实数据。
 */
import { computed, inject, onMounted, provide, ref, watch } from "vue";
import type { NodeSchema } from "@x-ac/web-design-core";
import {
  ensureArray,
  getByPath,
  moveArrayItem,
  pushArrayItem,
  removeArrayItem,
  setByPath,
} from "@x-ac/web-design-core";
import { BINDING_BASE, RENDER_CONTEXT } from "./context";
import { useMaterialCatalog } from "../materials/catalog";
import SchemaNode from "./SchemaNode.vue";
import BindingScope from "./BindingScope.vue";

const props = withDefaults(
  defineProps<{
    node: NodeSchema;
    scope: Record<string, unknown>;
    mode?: "view" | "edit";
    design?: boolean;
  }>(),
  { mode: "view", design: false },
);

const catalog = useMaterialCatalog();
const parentBase = inject(BINDING_BASE, "form");
const renderCtx = inject(RENDER_CONTEXT, null);

const effective = computed(() => catalog.defaults(props.node.component, props.node.props));
const itemPath = computed(() => String(effective.value.itemPath ?? "items"));
const fullPath = computed(() => (itemPath.value ? `${parentBase}.${itemPath.value}` : parentBase));
const minItems = computed(() => Number(effective.value.minItems ?? 0));
const maxItems = computed(() => Number(effective.value.maxItems ?? 0));
const addText = computed(() => String(effective.value.addText ?? "添加一项"));
const title = computed(() => String(effective.value.label ?? "明细"));

/** 设计态用一个本地预览组数，避免改动真实数据数组 */
const designCount = ref(1);

/**
 * 子表单内的显隐条件用「行级隔离作用域」求值：
 * 只把当前行放回原来的明细路径下（占位下标 0），组内元素读不到子表单外部数据。
 * 绑定仍走 BINDING_BASE + 全量 scope，不受影响。
 */
function isolatedScope(index: number): Record<string, unknown> {
  const arr = (getByPath(props.scope, fullPath.value) as unknown[] | undefined) ?? [];
  const row = arr[index] ?? {};
  const isolated: Record<string, unknown> = {};
  setByPath(isolated, `${fullPath.value}[0]`, row);
  return isolated;
}

const groups = computed<{ key: string; base: string }[]>(() => {
  if (props.design) {
    const n = Math.max(1, designCount.value);
    return Array.from({ length: n }, (_, i) => ({ key: `${props.node.id}-g${i}`, base: `${fullPath.value}[${i}]` }));
  }
  const arr = (getByPath(props.scope, fullPath.value) as unknown[] | undefined) ?? [];
  return arr.map((_, i) => ({ key: `${props.node.id}-g${i}`, base: `${fullPath.value}[${i}]` }));
});

/** 构造一组默认数据：优先用 defaultItem(JSON)，否则按子字段构造空值 */
function buildDefaultItem(): Record<string, unknown> {
  const raw = effective.value.defaultItem;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* 非法 JSON 时回落到按字段构造 */
    }
  }
  const item: Record<string, unknown> = {};
  for (const child of props.node.children ?? []) {
    const childMaterial = catalog.get(child.component);
    if (childMaterial?.isFormControl) item[child.id] = "";
  }
  return item;
}

function ensureData(): unknown[] {
  const arr = ensureArray(props.scope, fullPath.value);
  const floor = props.design ? Math.max(1, minItems.value) : minItems.value;
  while (arr.length < floor) arr.push(buildDefaultItem());
  return arr;
}

onMounted(ensureData);
watch(
  () => props.design,
  () => ensureData(),
);

function addGroup(): void {
  if (props.design) {
    designCount.value += 1;
    return;
  }
  const arr = ensureData();
  if (maxItems.value > 0 && arr.length >= maxItems.value) return;
  pushArrayItem(props.scope, fullPath.value, buildDefaultItem());
}

function removeGroup(index: number): void {
  if (props.design) {
    if (designCount.value > 1) designCount.value -= 1;
    return;
  }
  const arr = (getByPath(props.scope, fullPath.value) as unknown[]) ?? [];
  if (minItems.value > 0 && arr.length <= minItems.value) return;
  removeArrayItem(props.scope, fullPath.value, index);
}

function moveGroup(index: number, delta: number): void {
  if (props.design) return;
  moveArrayItem(props.scope, fullPath.value, index, index + delta);
}

/**
 * 子表单内字段的失焦校验无法唯一定位到「第几组」（模板共享节点 ID），
 * 故对子孙表单控件跳过全局失焦校验；提交时 collectFields 会逐组下钻统一校验兜底。
 */
if (renderCtx) {
  provide(RENDER_CONTEXT, {
    ...renderCtx,
    validateField: () => {
      /* 子表单内字段失焦校验交由提交时统一处理 */
    },
  });
}
</script>

<template>
  <div class="wb-subform">
    <div class="wb-subform__head">
      <span class="wb-subform__title">{{ title }}</span>
      <span v-if="!props.design && maxItems > 0" class="wb-subform__count">{{ groups.length }}/{{ maxItems }}</span>
    </div>

    <div v-for="(group, index) in groups" :key="group.key" class="wb-subform__group">
      <div class="wb-subform__group-head">
        <span class="wb-subform__group-index">#{{ index + 1 }}</span>
        <div class="wb-subform__ops">
          <button
            v-if="!props.design"
            type="button"
            class="wb-subform__btn"
            :disabled="minItems > 0 && groups.length <= minItems"
            @click="removeGroup(index)"
          >
            删除
          </button>
          <button
            v-if="!props.design"
            type="button"
            class="wb-subform__btn"
            :disabled="index === 0"
            @click="moveGroup(index, -1)"
          >
            上移
          </button>
          <button
            v-if="!props.design"
            type="button"
            class="wb-subform__btn"
            :disabled="index === groups.length - 1"
            @click="moveGroup(index, 1)"
          >
            下移
          </button>
        </div>
      </div>
      <BindingScope :base="group.base">
        <SchemaNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :scope="scope"
          :visibility-scope="isolatedScope(index)"
          :visibility-row-index="0"
          :mode="mode"
          :design="design"
        />
      </BindingScope>
    </div>

    <button
      type="button"
      class="wb-subform__add"
      :disabled="!props.design && maxItems > 0 && groups.length >= maxItems"
      @click="addGroup"
    >
      + {{ addText }}
    </button>
  </div>
</template>

<style scoped>
.wb-subform {
  display: block;
  margin: 8px 0;
  border: 1px dashed var(--wb-line, #dcdfe6);
  border-radius: 8px;
  padding: 12px;
  background: rgba(47, 75, 255, 0.02);
}
.wb-subform__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.wb-subform__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink1, #1f2329);
}
.wb-subform__count {
  font-size: 12px;
  color: var(--wb-ink3, #8a909c);
}
.wb-subform__group {
  border: 1px solid var(--wb-line, #dcdfe6);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: #fff;
}
.wb-subform__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.wb-subform__group-index {
  font-size: 12px;
  color: var(--wb-ink3, #8a909c);
}
.wb-subform__ops {
  display: flex;
  gap: 6px;
}
.wb-subform__btn,
.wb-subform__add {
  font-size: 12px;
  line-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--wb-line, #dcdfe6);
  border-radius: 4px;
  background: #fff;
  color: var(--wb-ink1, #1f2329);
  cursor: pointer;
}
.wb-subform__btn:disabled,
.wb-subform__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wb-subform__add {
  width: 100%;
  border-style: dashed;
  color: var(--wb-primary, #2f4bff);
}
</style>
