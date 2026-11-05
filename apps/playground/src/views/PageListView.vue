<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createPage,
  duplicatePage,
  ensureSeed,
  listPages,
  removePage,
  renamePage,
  type PageRecord,
} from "@/api/pageRepo";
import { TEMPLATES } from "@/data/templates";
import { countNodes } from "@x-ac/design-core";

const router = useRouter();
const pages = ref<PageRecord[]>([]);
const createVisible = ref(false);
const activeTemplate = ref("employee");
const renameVisible = ref(false);
const renameValue = ref("");
const renameTarget = ref<PageRecord | null>(null);

function refresh(): void {
  pages.value = listPages();
}

onMounted(() => {
  ensureSeed();
  refresh();
});

function nodeCount(record: PageRecord): number {
  return countNodes(record.schema.children);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createFromTemplate(): void {
  const template = TEMPLATES.find((item) => item.key === activeTemplate.value) ?? TEMPLATES[0];
  const page = template.build();
  page.meta = { ...(page.meta ?? {}), title: page.meta?.title ?? template.name };
  const record = createPage(page);
  createVisible.value = false;
  refresh();
  void router.push(`/designer/${record.id}`);
}

async function onRemove(record: PageRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除「${record.title}」？该操作不可撤销。`, "删除页面", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  removePage(record.id);
  refresh();
  ElMessage.success("已删除");
}

function onDuplicate(record: PageRecord): void {
  const copy = duplicatePage(record.id);
  refresh();
  if (copy) ElMessage.success("已复制");
}

function openRename(record: PageRecord): void {
  renameTarget.value = record;
  renameValue.value = record.title;
  renameVisible.value = true;
}

function submitRename(): void {
  if (!renameTarget.value) return;
  renamePage(renameTarget.value.id, renameValue.value.trim() || "未命名页面");
  renameVisible.value = false;
  refresh();
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="brand__mark" />
        <span>vue-design</span>
      </div>
      <span class="topbar__sub">Schema 驱动的页面可视化搭建</span>
      <div class="spacer" />
      <span class="topbar__hint">数据保存在浏览器本地，可导出 JSON 迁移</span>
      <el-button type="primary" @click="createVisible = true">新建页面</el-button>
    </header>

    <main class="content wb-scroll">
      <section class="hero">
        <h1>设计器拖拽搭页面，导出 JSON，随时还原继续编辑</h1>
        <p>
          页面由结构化 Schema 描述，不含坐标与 HTML 字符串；设计器与渲染器共用同一份数据。新建页面后可从模板起步，也可以从空白画布开始。
        </p>
      </section>

      <div v-if="pages.length" class="grid">
        <article v-for="record in pages" :key="record.id" class="card">
          <div class="card__head">
            <h3 class="card__title" :title="record.title">{{ record.title }}</h3>
            <el-dropdown trigger="click">
              <span class="card__more">···</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openRename(record)">重命名</el-dropdown-item>
                  <el-dropdown-item @click="onDuplicate(record)">复制</el-dropdown-item>
                  <el-dropdown-item divided @click="onRemove(record)">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <p class="card__desc">{{ record.schema.meta?.description ?? "暂无描述" }}</p>
          <div class="card__meta">
            <span>{{ nodeCount(record) }} 个节点</span>
            <span>·</span>
            <span>{{ record.schema.meta?.device ?? "pc" }}</span>
            <span>·</span>
            <span>{{ formatTime(record.updatedAt) }}</span>
          </div>
          <div class="card__actions">
            <el-button size="small" type="primary" plain @click="router.push(`/designer/${record.id}`)">
              编辑
            </el-button>
            <el-button size="small" @click="router.push(`/preview/${record.id}`)">预览</el-button>
          </div>
        </article>
      </div>

      <el-empty v-else description="还没有页面，先从模板新建一个" />

      <section class="flow">
        <div class="flow__item">
          <span class="flow__index">1</span>
          <div>
            <strong>拖拽搭建</strong>
            <p>左侧物料拖入画布，右侧改属性，所见即所得。</p>
          </div>
        </div>
        <div class="flow__item">
          <span class="flow__index">2</span>
          <div>
            <strong>结构化存储</strong>
            <p>保存的是 JSON Schema，不是 HTML，可 diff、可版本化。</p>
          </div>
        </div>
        <div class="flow__item">
          <span class="flow__index">3</span>
          <div>
            <strong>渲染器还原</strong>
            <p>同一份 Schema 交给渲染器，直接产出可交互页面。</p>
          </div>
        </div>
      </section>
    </main>

    <el-dialog v-model="createVisible" title="新建页面" width="520px">
      <div class="tpl-list">
        <label
          v-for="template in TEMPLATES"
          :key="template.key"
          class="tpl"
          :class="{ 'is-active': activeTemplate === template.key }"
        >
          <input v-model="activeTemplate" type="radio" :value="template.key" />
          <div>
            <div class="tpl__name">{{ template.name }}</div>
            <div class="tpl__desc">{{ template.description }}</div>
          </div>
        </label>
      </div>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="createFromTemplate">创建并进入设计器</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renameVisible" title="重命名页面" width="420px">
      <el-input v-model="renameValue" placeholder="页面标题" @keyup.enter="submitRename" />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRename">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid var(--wb-line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.01em;
}
.brand__mark {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--wb-primary);
}
.topbar__sub {
  font-size: 12px;
  color: var(--wb-ink3);
  padding-left: 10px;
  border-left: 1px solid var(--wb-line);
}
.topbar__hint {
  font-size: 12px;
  color: var(--wb-ink3);
}
.spacer {
  flex: 1;
}
.content {
  flex: 1;
  padding: 28px 20px 60px;
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 22px;
  letter-spacing: -0.01em;
}
.hero p {
  margin: 0 0 24px;
  max-width: 720px;
  color: var(--wb-ink2);
  font-size: 13px;
  line-height: 1.8;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  gap: 14px;
}
.card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--wb-line);
  border-radius: 10px;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.card:hover {
  box-shadow: 0 6px 20px rgba(20, 30, 60, 0.08);
  transform: translateY(-1px);
}
.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__more {
  cursor: pointer;
  color: var(--wb-ink3);
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}
.card__desc {
  margin: 6px 0 10px;
  font-size: 12px;
  color: var(--wb-ink3);
  min-height: 34px;
  line-height: 1.6;
}
.card__meta {
  display: flex;
  gap: 6px;
  font-size: 11.5px;
  color: var(--wb-ink3);
  margin-bottom: 14px;
}
.card__actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
.flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid var(--wb-line);
}
.flow__item {
  display: flex;
  gap: 10px;
}
.flow__index {
  flex: 0 0 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--wb-primary-soft);
  color: var(--wb-primary);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 20px;
}
.flow__item strong {
  font-size: 13px;
}
.flow__item p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--wb-ink3);
  line-height: 1.7;
}
.tpl-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tpl {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.tpl.is-active {
  border-color: var(--wb-primary);
  background: var(--wb-primary-soft);
}
.tpl input {
  margin-top: 3px;
}
.tpl__name {
  font-size: 13px;
  font-weight: 600;
}
.tpl__desc {
  font-size: 12px;
  color: var(--wb-ink3);
  margin-top: 2px;
}
</style>
