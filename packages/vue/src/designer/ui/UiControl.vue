<script setup lang="ts">
/**
 * 设计器控件入口：按槽位取「适配包实现 ?? 原生实现」。
 * 所有 props/events 都通过 $attrs 透传，控件契约只要求实现方接受同一组属性。
 */
import { computed } from "vue";
import { useDesignerUi, type DesignerSlot } from "./kit";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ as: DesignerSlot }>();
const ui = useDesignerUi();
const impl = computed(() => ui[props.as]);
</script>

<template>
  <component :is="impl" v-bind="$attrs">
    <slot />
  </component>
</template>
