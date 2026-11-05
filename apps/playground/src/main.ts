import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
// 宿主（本演示应用）只做三件事：装 UI 库、注入页面仓储、把设计器挂到路由上
import "@x-ac/design-vue";
import { setPageRepository } from "@x-ac/design-vue/designer";
import { ensureSeed, localStorageRepo } from "./api/pageRepo";
import "element-plus/dist/index.css";
import "./styles/index.css";
import App from "./App.vue";
import { router } from "./router";

setPageRepository(localStorageRepo);
ensureSeed();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
