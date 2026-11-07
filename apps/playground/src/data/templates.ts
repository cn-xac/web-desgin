import type { PageSchema } from "@x-ac/design-core";
/**
 * 内置模板。模板本身遵守「默认值不落库」，可作为 Schema 书写范本。
 * 每个模板都是可直接运行的完整页面：填表 → 校验 → 提交 → 列表刷新。
 */

function schema(partial: Omit<PageSchema, "schemaVersion" | "type">): PageSchema {
  return { schemaVersion: "1.0.0", type: "page", ...partial };
}

export const employeeOnboardTemplate = (): PageSchema =>
  schema({
    id: `page_${Math.random().toString(36).slice(2, 10)}`,
    meta: { title: "员工入职登记", device: "pc", description: "表单 + 必填校验 + 提交后进入列表" },
    state: {
      form: { name: "", mobile: "", dept: "", entryDate: "", remark: "" },
      list: [
        { name: "李思远", dept: "技术中心", entryDate: "2026-10-12", submitAt: "2026-10-10 09:12" },
        { name: "周雅", dept: "产品中心", entryDate: "2026-10-20", submitAt: "2026-10-18 14:35" },
      ],
    },
    children: [
      {
        id: "n_card_form",
        component: "ec-card",
        props: { title: "基本信息" },
        children: [
          {
            id: "n_title_form",
            component: "ec-title",
            props: { text: "员工入职登记", level: 3 },
          },
          {
            id: "n_text_intro",
            component: "ec-text",
            props: { text: "请填写新同事的基础信息，提交后会进入下方登记列表。可在右侧面板修改任何文案与绑定。", muted: true },
          },
          {
            id: "n_grid_form",
            component: "ec-grid",
            props: { columns: 2, gap: 16 },
            children: [
              {
                id: "n_in_name",
                component: "ec-input",
                props: { label: "姓名", placeholder: "请输入姓名", modelValue: "{{form.name}}" },
                rules: [
                  { type: "required" },
                  { type: "maxLength", value: 20 },
                ],
              },
              {
                id: "n_in_mobile",
                component: "ec-input",
                props: { label: "手机号", placeholder: "请输入手机号", modelValue: "{{form.mobile}}" },
                rules: [{ type: "required" }, { type: "phone" }],
              },
              {
                id: "n_sel_dept",
                component: "ec-select",
                props: { label: "所属部门", options: "技术中心,产品中心,设计中心", modelValue: "{{form.dept}}" },
                rules: [{ type: "required" }],
              },
              {
                id: "n_date_entry",
                component: "ec-date",
                props: { label: "入职日期", modelValue: "{{form.entryDate}}" },
                rules: [{ type: "required" }],
              },
            ],
          },
          {
            id: "n_ta_remark",
            component: "ec-textarea",
            props: { label: "备注", placeholder: "如：需准备设备、工位等", modelValue: "{{form.remark}}" },
            rules: [{ type: "maxLength", value: 100 }],
          },
          {
            id: "n_space_actions",
            component: "ec-space",
            props: { size: 12 },
            children: [
              {
                id: "n_btn_submit",
                component: "ec-button",
                props: { text: "提交登记", type: "primary" },
                events: {
                  click: [{ action: "submitForm", args: { from: "form", to: "list", successText: "登记成功，已加入列表" } }],
                },
              },
              {
                id: "n_btn_reset",
                component: "ec-button",
                props: { text: "重置", plain: true },
                events: { click: [{ action: "resetForm", args: { path: "form" } }] },
              },
            ],
          },
        ],
      },
      { id: "n_divider_list", component: "ec-divider", props: {} },
      {
        id: "n_card_list",
        component: "ec-card",
        props: { title: "最近登记" },
        children: [
          {
            id: "n_table_list",
            component: "ec-table",
            props: {
              columns: [
                { label: "姓名", prop: "name" },
                { label: "部门", prop: "dept" },
                { label: "入职日期", prop: "entryDate" },
                { label: "提交时间", prop: "submitAt" },
              ],
              data: "{{list}}",
            },
          },
          {
            id: "n_text_empty",
            component: "ec-text",
            props: { text: "还没有登记记录，填写上方表单试试。", muted: true },
            directives: [{ name: "show", value: "list.length === 0" }],
          },
          {
            id: "n_btn_clear",
            component: "ec-button",
            props: { text: "清空列表", plain: true, size: "small" },
            directives: [{ name: "show", value: "list.length > 0" }],
            events: { click: [{ action: "clearList", args: { path: "list" } }] },
          },
        ],
      },
    ],
  });

export const ticketTemplate = (): PageSchema =>
  schema({
    id: `page_${Math.random().toString(36).slice(2, 10)}`,
    meta: { title: "需求工单提交", device: "pc", description: "业务组件（组织/字典/金额）+ 多控件表单" },
    state: {
      ticket: {
        title: "",
        org: "",
        priority: "",
        channel: "官网",
        budget: 0,
        urgency: 3,
        channels: ["官网"],
        needFollowUp: true,
        detail: "",
      },
      tickets: [
        { title: "活动页改版", org: "hq-product", priority: "P1", channel: "官网", budget: 120000, submitAt: "2026-11-02 10:20" },
      ],
    },
    children: [
      {
        id: "n_card_ticket",
        component: "ec-card",
        props: { title: "工单信息" },
        children: [
          { id: "n_title_ticket", component: "ec-title", props: { text: "需求工单", level: 3 } },
          // 业务物料（apps/playground/src/materials 注册）：证明自研组件与官方物料同处一条链路
          {
            id: "n_biz_risk",
            component: "biz-risk-badge",
            props: { text: "风险待评估", level: "中", round: true },
          },
          {
            id: "n_alert_tip",
            component: "ec-alert",
            props: {
              title: "提交前请确认需求目标与验收标准",
              type: "info",
              description: "带 * 的为必填项，未填写时点击提交会给出字段级提示。",
            },
          },
          {
            id: "n_grid_ticket",
            component: "ec-grid",
            props: { columns: 2, gap: 16 },
            children: [
              {
                id: "n_in_ticket_title",
                component: "ec-input",
                props: { label: "需求标题", placeholder: "一句话说明要做什么", modelValue: "{{ticket.title}}" },
                rules: [
                  { type: "required" },
                  { type: "minLength", value: 4 },
                  { type: "maxLength", value: 40 },
                ],
              },
              {
                id: "n_org_picker",
                component: "ec-org-picker",
                props: { label: "归属组织", modelValue: "{{ticket.org}}" },
                rules: [{ type: "required" }],
              },
              {
                id: "n_dict_priority",
                component: "ec-dict-select",
                props: { label: "优先级", dict: "priority", modelValue: "{{ticket.priority}}" },
                rules: [{ type: "required" }],
              },
              {
                id: "n_amount_budget",
                component: "ec-amount-input",
                props: { label: "预算", modelValue: "{{ticket.budget}}", precision: 0 },
                rules: [{ type: "min", value: 0 }],
              },
              {
                id: "n_rate_urgency",
                component: "ec-rate",
                props: { label: "紧急程度", modelValue: "{{ticket.urgency}}" },
              },
              {
                id: "n_slider_scope",
                component: "ec-slider",
                props: { label: "影响范围", modelValue: "{{ticket.urgency}}", min: 1, max: 5, step: 1 },
              },
            ],
          },
          {
            id: "n_checkbox_channel",
            component: "ec-checkbox",
            props: { label: "触达渠道", options: "官网,小程序,线下", modelValue: "{{ticket.channels}}" },
          },
          {
            id: "n_switch_follow",
            component: "ec-switch",
            props: { label: "需要回访", modelValue: "{{ticket.needFollowUp}}" },
          },
          {
            id: "n_ta_detail",
            component: "ec-textarea",
            props: { label: "需求详情", placeholder: "目标用户、痛点、期望效果", rows: 4, modelValue: "{{ticket.detail}}" },
          },
          {
            id: "n_space_ticket_actions",
            component: "ec-space",
            props: { size: 12 },
            children: [
              {
                id: "n_btn_ticket_submit",
                component: "ec-button",
                props: { text: "提交工单", type: "primary" },
                events: {
                  click: [
                    {
                      action: "submitForm",
                      args: {
                        from: "ticket",
                        to: "tickets",
                        fields: ["title", "org", "priority", "channel", "budget"],
                        successText: "工单已提交",
                      },
                    },
                  ],
                },
              },
              {
                id: "n_btn_ticket_reset",
                component: "ec-button",
                props: { text: "重置", plain: true },
                events: { click: [{ action: "resetState", args: {} }] },
              },
            ],
          },
        ],
      },
      {
        id: "n_card_ticket_list",
        component: "ec-card",
        props: { title: "工单列表" },
        children: [
          {
            id: "n_table_tickets",
            component: "ec-table",
            props: {
              columns: [
                { label: "标题", prop: "title" },
                { label: "优先级", prop: "priority" },
                { label: "组织", prop: "org" },
                { label: "预算", prop: "budget" },
                { label: "提交时间", prop: "submitAt" },
              ],
              data: "{{tickets}}",
              stripe: true,
            },
          },
        ],
      },
    ],
  });

export const blankTemplate = (title = "空白页面"): PageSchema =>
  schema({
    id: `page_${Math.random().toString(36).slice(2, 10)}`,
    meta: { title, device: "pc" },
    state: {},
    children: [],
  });

export interface TemplateItem {
  key: string;
  name: string;
  description: string;
  build: () => PageSchema;
}

export const TEMPLATES: TemplateItem[] = [
  {
    key: "employee",
    name: "员工入职登记",
    description: "表单 + 必填校验 + 提交进列表，最贴近中后台场景",
    build: employeeOnboardTemplate,
  },
  {
    key: "ticket",
    name: "需求工单提交",
    description: "业务组件示例：组织选择、字典下拉、金额输入",
    build: ticketTemplate,
  },
  {
    key: "blank",
    name: "空白页面",
    description: "从零开始拖拽搭建",
    build: () => blankTemplate(),
  },
];
