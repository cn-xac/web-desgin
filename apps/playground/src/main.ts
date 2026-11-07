import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
// 宿主（本演示应用）只做四件事：装 UI 库、选适配包、注入页面仓储、把设计器挂到路由上
import { createVueDesign } from "@x-ac/design-vue";
import { setPageRepository } from "@x-ac/design-vue/designer";
import { playgroundAdapter } from "./materials";
import { ensureSeed, localStorageRepo } from "./api/pageRepo";
import "element-plus/dist/index.css";
import "@x-ac/design-vue/style.css";
import "./styles/index.css";
import App from "./App.vue";
import { router } from "./router";

setPageRepository(localStorageRepo);
ensureSeed();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
// 适配包 = Element Plus + 一份业务物料声明；换成别的库只改这一行
app.use(createVueDesign({ adapter: playgroundAdapter }));
app.mount("#app");
