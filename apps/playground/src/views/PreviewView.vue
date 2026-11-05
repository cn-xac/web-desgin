<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getPage, type PageRecord } from "@/api/pageRepo";
import { SchemaRenderer } from "@x-ac/design-vue";
import { toDataJSON, toJSON } from "@x-ac/design-core";

const props = defineProps<{ id: string }>();
const router = useRouter();
const record = ref<PageRecord | null>(null);
const mountKey = ref(0);
const renderer = ref<InstanceType<typeof SchemaRenderer> | null>(null);

const dialog = ref({ open: false, title: "", body: "", download: false });

onMounted(() => {
  record.value = getPage(props.id);
});

const page = computed(() => record.value?.schema ?? null);

function reset(): void {
  mountKey.value += 1;
  ElMessage.success("已重置页面数据");
}

function navigate(to: string): void {
  if (/^https?:/.test(to)) {
    window.open(to, "_blank");
    return;
  }
  void router.push(to);
}

function exportJSON(): void {
  if (!record.value) return;
  const json = toJSON(record.value.schema);
  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${record.value.title}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ---------------- 数据相关：校验 / 导出 ---------------- */

function validateData(): void {
  const api = renderer.value;
  if (!api) return;

  const result = api.getData();
  const ok = api.validate();

  if (ok) {
    ElMessage.success(`校验通过：${result.fields.length} 个字段全部合法`);
    return;
  }

  dialog.value = {
    open: true,
    title: `校验未通过（${result.errors.length} 项）`,
    body: result.errors.map((item) => `· ${item.label}：${item.message}（${item.rule}）`).join("\n"),
    download: false,
  };
}

function exportFormData(): void {
  const api = renderer.value;
  if (!api) return;

  const result = api.getData();
  dialog.value = {
    open: true,
    title: result.valid ? "表单数据（校验通过）" : `表单数据（${result.errors.length} 项未通过）`,
    body: toDataJSON(result, { includeMeta: true }),
    download: true,
  };
}

function copyDialog(): void {
  void navigator.clipboard?.writeText(dialog.value.body);
  ElMessage.success("已复制到剪贴板");
}

function downloadDialog(): void {
  const blob = new Blob([dialog.value.body], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${record.value?.title ?? "form-data"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
</script>

<template>
  <div class="preview">
    <header class="topbar">
      <button class="icon-btn" title="返回列表" @click="router.push('/pages')">←</button>
      <span class="topbar__title">{{ record?.title ?? "预览" }}</span>
      <span class="topbar__badge">运行时渲染</span>
      <div class="spacer" />
      <span class="topbar__hint">渲染器只消费 Schema，不加载设计器代码</span>
      <el-button size="small" @click="validateData">验证数据</el-button>
      <el-button size="small" @click="exportFormData">导出数据</el-button>
      <el-button size="small" @click="exportJSON">导出 JSON</el-button>
      <el-button size="small" @click="reset">重置数据</el-button>
      <el-button size="small" type="primary" @click="router.push(`/designer/${props.id}`)">进入设计器</el-button>
    </header>

    <main class="stage wb-scroll">
      <div v-if="page" :key="mountKey" class="canvas">
        <SchemaRenderer ref="renderer" :page="page" mode="view" :navigate="navigate" />
      </div>
      <el-result v-else icon="warning" title="页面不存在" sub-title="该页面可能已被删除，请返回列表重新创建">
        <template #extra>
          <el-button type="primary" @click="router.push('/pages')">返回列表</el-button>
        </template>
      </el-result>
    </main>

    <el-dialog v-model="dialog.open" :title="dialog.title" width="620px" append-to-body>
      <pre class="dialog__body">{{ dialog.body }}</pre>
      <template #footer>
        <el-button size="small" @click="copyDialog">复制</el-button>
        <el-button v-if="dialog.download" size="small" type="primary" @click="downloadDialog">下载 JSON</el-button>
        <el-button size="small" @click="dialog.open = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 14px;
  background: #fff;
  border-bottom: 1px solid var(--wb-line);
  flex: 0 0 auto;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--wb-ink2);
  font-size: 14px;
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--wb-bg);
}
.topbar__title {
  font-size: 13.5px;
  font-weight: 600;
}
.topbar__badge {
  font-size: 11px;
  color: #12a150;
  background: #e8f8ee;
  border-radius: 4px;
  padding: 1px 6px;
}
.topbar__hint {
  font-size: 11.5px;
  color: var(--wb-ink3);
}
.spacer {
  flex: 1;
}
.stage {
  flex: 1;
  padding: 28px 20px 60px;
  background: var(--wb-bg);
}
.canvas {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(20, 30, 60, 0.08), 0 10px 30px rgba(20, 30, 60, 0.05);
}
.dialog__body {
  max-height: 420px;
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  border-radius: 6px;
  background: #f7f8fb;
  font-family: var(--wb-mono);
  font-size: 12px;
  line-height: 1.65;
  color: var(--wb-ink2);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
