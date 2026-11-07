<script setup lang="ts">
/**
 * 文本。用 ElText 而不是裸 <p>：EP 的 type（success / danger）、truncated、
 * tag 都是真实属性，用裸标签就只能靠 CSS 硬凑。
 *
 * `size` 与 `muted` 保持了原 text 物料的语义（core 里标为 internalProps，
 * 由这里转成 ElText 的 size 与 type），历史 Schema 不需要迁移。
 */
withDefaults(
  defineProps<{
    /** 正文由渲染器经默认插槽传入（物料声明了 textProp: "text"） */
    text?: string;
    size?: "large" | "default" | "small";
    muted?: boolean;
    type?: "" | "primary" | "success" | "warning" | "danger" | "info";
    truncated?: boolean;
    tag?: string;
  }>(),
  { text: "", size: "default", muted: false, type: "", truncated: false, tag: "p" },
);
</script>

<template>
  <el-text
    :size="size"
    :type="type || (muted ? 'info' : undefined)"
    :truncated="truncated"
    :tag="tag || 'p'"
  >
    <slot />
  </el-text>
</template>
