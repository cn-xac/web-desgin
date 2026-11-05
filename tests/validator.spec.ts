import { describe, expect, it } from "vitest";
import { validatePage } from "@x-ac/design-core";
import { KNOWN_COMPONENTS } from "@x-ac/design-core";
import type { PageSchema } from "@x-ac/design-core";

function basePage(): PageSchema {
  return {
    schemaVersion: "1.0.0",
    id: "page_test",
    type: "page",
    meta: { title: "测试页", device: "pc" },
    children: [
      {
        id: "n_card",
        component: "card",
        props: { title: "基本信息" },
        children: [{ id: "n_in", component: "input", props: { label: "姓名", modelValue: "{{form.name}}" } }],
      },
    ],
  };
}

describe("Schema 校验", () => {
  it("合法页面通过", () => {
    const result = validatePage(basePage(), KNOWN_COMPONENTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("缺少必填字段报错", () => {
    const result = validatePage({ type: "page" }, KNOWN_COMPONENTS);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.path)).toContain("schemaVersion");
    expect(result.errors.map((e) => e.path)).toContain("id");
    expect(result.errors.map((e) => e.path)).toContain("children");
  });

  it("节点 id 重复报错", () => {
    const page = basePage();
    page.children.push({ id: "n_card", component: "text", props: { text: "重复 id" } });
    const result = validatePage(page, KNOWN_COMPONENTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("重复"))).toBe(true);
  });

  it("未知组件只告警不阻断", () => {
    const page = basePage();
    page.children.push({ id: "n_custom", component: "not-registered" });
    const result = validatePage(page, KNOWN_COMPONENTS);
    expect(result.valid).toBe(true);
    expect(result.warnings[0].message).toContain("未注册");
  });

  it("非法指令名报错", () => {
    const page = basePage();
    page.children[0].directives = [{ name: "v-if" as never, value: "a" }];
    const result = validatePage(page, KNOWN_COMPONENTS);
    expect(result.valid).toBe(false);
  });

  it("事件的 action 必须非空字符串", () => {
    const page = basePage();
    page.children[0].events = { click: [{ action: "" }] };
    expect(validatePage(page, KNOWN_COMPONENTS).valid).toBe(false);
  });

  it("for 指令必须有遍历表达式", () => {
    const page = basePage();
    page.children[0].directives = [{ name: "for" }];
    expect(validatePage(page, KNOWN_COMPONENTS).valid).toBe(false);
  });

  it("非对象输入直接判失败", () => {
    expect(validatePage(null, KNOWN_COMPONENTS).valid).toBe(false);
    expect(validatePage("{}", KNOWN_COMPONENTS).valid).toBe(false);
    expect(validatePage([], KNOWN_COMPONENTS).valid).toBe(false);
  });
});
