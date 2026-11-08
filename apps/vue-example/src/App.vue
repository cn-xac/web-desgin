<script setup lang="ts">
import NativeExample from "./examples/native/NativeExample.vue";
</script>

<template>
  <main class="page">
    <header class="page__head">
      <h1>@x-ac/design 三包用法示例</h1>
      <p>
        本页基于 <code>@x-ac/design-core</code> + <code>@x-ac/design-vue</code>，注册了 3 个零依赖原生组件，
        演示「Schema 驱动渲染 + 数据双向绑定 + 事件通知 + Schema 导出」。
      </p>
    </header>

    <NativeExample />

    <footer class="page__foot">
      <p>另见 <a href="/react/">React 版示例（@x-ac/design-react）</a>。</p>
    </footer>
  </main>
</template>
