// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import { SchemaRenderer } from "@x-ac/design-vue";
import type { PageSchema } from "@x-ac/design-core";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
  }
});

const page: PageSchema = {
  schemaVersion: "1.0.0",
  id: "page_validate",
  type: "page",
  meta: { title: "校验", device: "pc" },
  state: { form: { name: "", note: "" }, list: [] },
  children: [
    {
      id: "v_name",
      component: "input",
      props: { label: "姓名", modelValue: "{{form.name}}" },
      rules: [{ type: "required" }, { type: "minLength", value: 2 }, { type: "maxLength", value: 6 }],
    },
    {
      id: "v_note",
      component: "textarea",
      props: { label: "备注", modelValue: "{{form.note}}" },
      rules: [{ type: "maxLength", value: 5, message: "{label}最多 {value} 个字" }],
    },
  ],
};

function mountRenderer() {
  return mount(SchemaRenderer, {
    props: { page },
    global: { plugins: [ElementPlus] },
  });
}

describe("渲染器：校验与导出 API", () => {
  it("validate() 返回结果并把错误画到字段下", async () => {
    const wrapper = mountRenderer();
    const api = wrapper.vm as unknown as {
      validate: () => boolean;
      getData: () => { valid: boolean; flat: Record<string, unknown> };
    };

    expect(api.validate()).toBe(false);
    await nextTick();
    expect(wrapper.find(".wb-field__error").text()).toBe("请填写姓名");

    expect(api.validate()).toBe(false);
    expect(api.getData().valid).toBe(false);
  });

  it("失焦触发单字段校验，改对后错误消失", async () => {
    const wrapper = mountRenderer();
    const input = wrapper.find("input");

    await input.trigger("focusout");
    await nextTick();
    expect(wrapper.find(".wb-field__error").exists()).toBe(true);

    await input.setValue("王小明");
    await input.trigger("focusout");
    await nextTick();
    expect(wrapper.find(".wb-field__error").exists()).toBe(false);
  });

  it("getData() 收集到当前输入值", async () => {
    const wrapper = mountRenderer();
    await wrapper.find("input").setValue("王小明");
    await wrapper.find("textarea").setValue("备注内容");

    const api = wrapper.vm as unknown as {
      getData: () => { valid: boolean; data: Record<string, unknown>; flat: Record<string, unknown> };
    };
    const result = api.getData();

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ form: { name: "王小明", note: "备注内容" } });
    expect(result.flat["form.name"]).toBe("王小明");
  });

  it("超出长度时使用自定义文案", async () => {
    const wrapper = mountRenderer();
    await wrapper.find("input").setValue("王小明");
    await wrapper.find("textarea").setValue("一二三四五六");

    const api = wrapper.vm as unknown as { validate: () => boolean };
    expect(api.validate()).toBe(false);
    await nextTick();
    expect(wrapper.text()).toContain("备注最多 5 个字");
  });
});
