<script setup lang="ts">
/**
 * 说明提示（问号图标 + 悬浮说明）。
 *
 * 浮层跟随宿主 UI 库：适配包提供 `designer.Tooltip` 时用它的实现，
 * 缺省回落引擎自带的原生实现（NativeTooltip，零 UI 库依赖）。
 *
 * 契约见 core 的 `DesignerKit.Tooltip`：
 * - props：`text`（说明文案）
 * - 默认插槽：触发元素（引擎提供问号按钮，浮层由实现方负责）
 *
 * 各家 API 不同（Element Plus 是 content、antd 是 title、naive 走默认插槽），
 * 差异由适配包的包装组件消化，引擎侧只认 `text`。
 */
import { computed, inject, type Component } from "vue";
import { UI_ADAPTER } from "../../renderer/context";
import { NativeTooltip } from "./native";

defineProps<{ text: string }>();

const adapter = inject(UI_ADAPTER, null);
/** 适配包实现 ?? 原生实现 */
const impl = computed<Component>(() => (adapter?.designer?.Tooltip as Component) ?? NativeTooltip);
</script>

<template>
  <component :is="impl" :text="text">
    <button type="button" class="wbd-tip__trigger" :aria-label="text" @click.stop>?</button>
  </component>
</template>
