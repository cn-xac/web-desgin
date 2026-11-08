import { createApp } from "vue";
import { createVueDesign } from "@x-ac/design-vue";
import "@x-ac/design-vue/style.css";
import "./styles.css";
import App from "./App.vue";

// 全局注入适配包；本示例的 SchemaRenderer 也会在组件级再传 :adapter="demoAdapter" 做一次覆盖演示。
const app = createApp(App);
app.use(createVueDesign());
app.mount("#app");
