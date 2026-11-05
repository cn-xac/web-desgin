import type { PageSchema } from "@x-ac/design-core";

/**
 * 示例页面：与 Vue 示例同构的一份 Schema。
 * 同一份 JSON 交给 @x-ac/design-vue 或 @x-ac/design-react，渲染结果一致。
 */
export function createDemoPage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_react_demo",
    type: "page",
    meta: { title: "React 渲染示例", device: "pc" },
    state: {
      form: { name: "", dept: "", note: "" },
      list: [{ name: "李思远", dept: "技术中心", submitAt: "2026-11-04 10:12" }],
    },
    children: [
      {
        id: "rt_title",
        component: "title",
        props: { text: "员工登记（React 渲染）" },
        style: { margin: "0 0 4px" },
      },
      {
        id: "rt_tip",
        component: "text",
        props: {
          text: "这一页的 Schema 与 Vue 示例同构：表达式、必填校验、动作白名单、margin / padding 全部来自 @x-ac/design-core。",
        },
        style: { margin: "0 0 16px" },
      },
      {
        id: "rt_card",
        component: "card",
        props: { title: "基本信息" },
        style: { padding: "16px", margin: "0 0 16px" },
        children: [
          {
            id: "rt_name",
            component: "input",
            props: { label: "姓名", placeholder: "请输入姓名", modelValue: "{{form.name}}" },
            rules: [
              { type: "required" },
              { type: "minLength", value: 2 },
              { type: "maxLength", value: 20 },
            ],
            style: { marginBottom: "12px" },
          },
          {
            id: "rt_dept",
            component: "select",
            props: {
              label: "部门",
              options: "技术中心,产品中心,设计中心",
              placeholder: "请选择部门",
              modelValue: "{{form.dept}}",
            },
            rules: [{ type: "required" }],
            style: { marginBottom: "12px" },
          },
          {
            id: "rt_note",
            component: "textarea",
            props: { label: "备注", modelValue: "{{form.note}}" },
            rules: [{ type: "maxLength", value: 50, message: "备注不要超过 {value} 个字" }],
            style: { marginBottom: "12px" },
          },
          {
            id: "rt_actions",
            component: "space",
            children: [
              {
                id: "rt_submit",
                component: "button",
                props: { text: "提交" },
                style: { marginRight: "8px" },
                events: {
                  click: [
                    {
                      action: "submitForm",
                      args: { from: "form", to: "list", successText: "已提交一条记录" },
                    },
                  ],
                },
              },
              {
                id: "rt_reset",
                component: "button",
                props: { text: "重置" },
                events: { click: [{ action: "resetState" }] },
              },
            ],
          },
        ],
      },
      {
        id: "rt_table_card",
        component: "card",
        props: { title: "已提交记录" },
        style: { padding: "16px" },
        children: [
          {
            id: "rt_table",
            component: "table",
            props: {
              columns: "姓名:name,部门:dept,提交时间:submitAt",
              data: "{{list}}",
              emptyText: "还没有记录",
            },
          },
        ],
      },
    ],
  };
}
