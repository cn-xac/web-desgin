import { createRouter, createWebHashHistory } from "vue-router";
import PageListView from "@/views/PageListView.vue";

export const router = createRouter({
  // hash 模式：静态托管 / 直接双击 dist/index.html 都能跑
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/pages" },
    { path: "/pages", name: "pages", component: PageListView },
    {
      path: "/designer/:id",
      name: "designer",
      // 设计器懒加载：首屏与渲染器产物都不含设计器代码
      component: () => import("@/views/DesignerRoute.vue"),
      props: true,
    },
    { path: "/preview/:id", name: "preview", component: () => import("@/views/PreviewView.vue"), props: true },
    { path: "/:pathMatch(.*)*", redirect: "/pages" },
  ],
});
