<script setup lang="ts">
/**
 * 上传。
 *
 * 刻意把 `autoUpload` 默认设为 false：设计器里点一下按钮就真的发请求、
 * 往用户服务器上传文件，属于「打开页面就产生副作用」，比不好看危险得多。
 * 真正需要自动上传时再显式打开。
 */
withDefaults(
  defineProps<{
    action?: string;
    text?: string;
    tip?: string;
    listType?: "text" | "picture" | "picture-card";
    multiple?: boolean;
    limit?: number;
    accept?: string;
    drag?: boolean;
    autoUpload?: boolean;
    showFileList?: boolean;
    disabled?: boolean;
    withCredentials?: boolean;
  }>(),
  {
    action: "",
    text: "点击上传",
    tip: "",
    listType: "text",
    multiple: false,
    limit: 0,
    accept: "",
    drag: false,
    autoUpload: false,
    showFileList: true,
    disabled: false,
    withCredentials: false,
  },
);
</script>

<template>
  <el-upload
    :action="action || '#'"
    :list-type="listType"
    :multiple="multiple"
    :limit="Number(limit) || undefined"
    :accept="accept || undefined"
    :drag="drag"
    :auto-upload="autoUpload"
    :show-file-list="showFileList"
    :disabled="disabled"
    :with-credentials="withCredentials"
  >
    <template v-if="listType === 'picture-card'">
      <span class="wb-upload__plus">+</span>
    </template>
    <el-button v-else type="primary" plain :disabled="disabled">{{ text }}</el-button>
    <template v-if="tip" #tip>
      <div class="wb-upload__tip">{{ tip }}</div>
    </template>
  </el-upload>
</template>

<style scoped>
.wb-upload__plus {
  font-size: 24px;
  color: var(--el-text-color-secondary);
}
.wb-upload__tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
}
</style>
