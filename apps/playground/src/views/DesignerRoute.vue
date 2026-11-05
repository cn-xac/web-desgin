<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DesignerView } from "@x-ac/design-vue/designer";

/**
 * 路由适配层：把 URL 参数转成设计器的 props，把设计器事件转成路由跳转。
 * 设计器本身不认识路由，所以嵌到任何后台系统都只需要这样一个薄壳。
 */
const route = useRoute();
const router = useRouter();
const pageId = computed(() => String(route.params.id ?? ""));

function previewUrl(id: string): string {
  return `${window.location.pathname}#/preview/${id}`;
}
</script>

<template>
  <DesignerView
    :key="pageId"
    :page-id="pageId"
    :preview-url="previewUrl"
    @back="router.push('/pages')"
    @preview="() => undefined"
  />
</template>
