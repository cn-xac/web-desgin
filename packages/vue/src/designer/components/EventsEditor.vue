<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ActionSchema } from "@x-ac/design-core";
import { ACTION_OPTIONS } from "@x-ac/design-core";
import { getMaterial } from "@x-ac/design-core";
import { useDesignerStore } from "../store";

const store = useDesignerStore();

const node = computed(() => store.selectedNode);
const material = computed(() => (node.value ? getMaterial(node.value.component) : undefined));
const events = computed(() => material.value?.events ?? []);

const DEFAULT_ARGS: Record<string, Record<string, unknown>> = {
  toast: { text: "操作成功", type: "success" },
  submitForm: { from: "form", to: "list" },
  resetForm: { path: "form" },
  resetState: {},
  setState: { path: "form.name", value: "" },
  clearList: { path: "list" },
  confirm: { text: "确认执行该操作？" },
  navigate: { to: "/pages" },
};

function actionsOf(name: string): ActionSchema[] {
  return node.value?.events?.[name] ?? [];
}

function write(name: string, list: ActionSchema[]): void {
  store.setEventActions(name, list);
}

function addAction(name: string): void {
  write(name, [...actionsOf(name), { action: "toast", args: { ...DEFAULT_ARGS.toast } }]);
}

function changeAction(name: string, index: number, action: string): void {
  const list = actionsOf(name).slice();
  list[index] = { action, args: { ...(DEFAULT_ARGS[action] ?? {}) } };
  write(name, list);
}

function changeArgs(name: string, index: number, text: string): void {
  let args: Record<string, unknown>;
  try {
    const parsed = text.trim() ? JSON.parse(text) : {};
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("args 必须是对象");
    args = parsed as Record<string, unknown>;
  } catch (error) {
    ElMessage.error(`参数不是合法 JSON：${(error as Error).message}`);
    return;
  }
  const list = actionsOf(name).slice();
  list[index] = { ...list[index], args };
  write(name, list);
}

function removeAction(name: string, index: number): void {
  const list = actionsOf(name).slice();
  list.splice(index, 1);
  write(name, list);
}

function argsText(action: ActionSchema): string {
  return JSON.stringify(action.args ?? {}, null, 2);
}
</script>

<template>
  <div class="events">
    <div class="events__note">
      事件只存「动作名 + 参数」，Schema 里不出现可执行代码。动作由渲染器注册表实现，新增动作需要改代码。
    </div>

    <section v-for="event in events" :key="event.name" class="events__group">
      <div class="events__head">
        <span class="events__name">{{ event.title }}</span>
        <span class="events__code">{{ event.name }}</span>
        <div class="spacer" />
        <el-button size="small" text type="primary" @click="addAction(event.name)">+ 动作</el-button>
      </div>

      <div v-if="!actionsOf(event.name).length" class="events__empty">未配置动作，点击「+ 动作」添加</div>

      <div v-for="(action, index) in actionsOf(event.name)" :key="index" class="events__item">
        <div class="events__item-head">
          <el-select
            :model-value="action.action"
            size="small"
            style="width: 100%"
            @update:model-value="(v: string) => changeAction(event.name, index, v)"
          >
            <el-option v-for="option in ACTION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <button class="events__del" title="删除" @click="removeAction(event.name, index)">×</button>
        </div>
        <el-input
          type="textarea"
          :rows="3"
          size="small"
          :model-value="argsText(action)"
          placeholder="参数 JSON"
          @change="(v: string) => changeArgs(event.name, index, v)"
        />
      </div>
    </section>

    <div v-if="!events.length" class="events__empty">当前组件没有可配置事件</div>
  </div>
</template>

<style scoped>
.events {
  padding: 14px;
}
.events__note {
  margin-bottom: 14px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fafbfd;
  border: 1px solid var(--wb-line-soft);
  font-size: 11.5px;
  color: var(--wb-ink3);
  line-height: 1.6;
}
.events__group {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--wb-line);
}
.events__group:last-child {
  border-bottom: none;
}
.events__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.events__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink2);
}
.events__code {
  font-family: var(--wb-mono);
  font-size: 10.5px;
  color: var(--wb-ink3);
  background: var(--wb-bg);
  border-radius: 3px;
  padding: 0 4px;
}
.spacer {
  flex: 1;
}
.events__item {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid var(--wb-line);
  border-radius: 6px;
  background: #fff;
}
.events__item-head {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.events__del {
  border: none;
  background: transparent;
  color: var(--wb-ink3);
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
.events__del:hover {
  color: var(--el-color-danger);
}
.events__empty {
  font-size: 12px;
  color: var(--wb-ink3);
  padding: 6px 0;
}
</style>
