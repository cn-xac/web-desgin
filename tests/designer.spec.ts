// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDesignerStore } from "@/designer/store";
import { createEmptyPage } from "@x-ac/web-design-core";
import { getPage, localStorageRepo } from "@/api/pageRepo";
import { setPageRepository } from "@x-ac/web-design-vue/designer";

function freshStore() {
  setActivePinia(createPinia());
  const store = useDesignerStore();
  const page = createEmptyPage("测试页");
  store.setPage(page);
  return { store, page };
}

describe("设计器状态层", () => {
  beforeEach(() => {
    localStorage.clear();
    setPageRepository(localStorageRepo);
  });

  it("新增节点只带空 props，默认值不落库", () => {
    const { store } = freshStore();
    store.addNode("input");
    expect(store.page.children).toHaveLength(1);
    expect(store.page.children[0].props).toEqual({});
    expect(store.selectedId).toBe(store.page.children[0].id);
  });

  it("改属性写入 Schema，改回默认值则删除该键", () => {
    const { store } = freshStore();
    store.addNode("input");
    store.updateProp("label", "姓名");
    expect(store.selectedNode?.props?.label).toBe("姓名");

    // required 默认 false，写成 false 应被剔除
    store.updateProp("required", false);
    expect(store.selectedNode?.props).not.toHaveProperty("required");

    store.updateProp("label", "字段名");
    expect(store.selectedNode?.props).not.toHaveProperty("label");
  });

  it("撤销 / 重做可回到任意一步（连续输入同一属性合并为一步）", () => {
    const { store } = freshStore();
    store.addNode("text");
    store.updateProp("text", "第一版");
    store.updateProp("text", "第二版");
    expect(store.selectedNode?.props?.text).toBe("第二版");

    store.undo();
    expect(store.page.children).toHaveLength(1);
    expect(store.page.children[0].props?.text).toBeUndefined();
    expect(store.selectedNode).toBeNull();

    store.undo();
    expect(store.page.children).toHaveLength(0);
    expect(store.canUndo).toBe(false);

    store.redo();
    expect(store.page.children).toHaveLength(1);
    expect(store.canRedo).toBe(true);
  });

  it("复制节点生成新 id 且深拷贝", () => {
    const { store } = freshStore();
    store.addNode("card");
    const sourceId = store.page.children[0].id;
    store.addNode("input", sourceId, "inside");
    store.select(sourceId);
    store.duplicateSelected();

    expect(store.page.children).toHaveLength(2);
    const copy = store.page.children[1];
    expect(copy.id).not.toBe(sourceId);
    expect(copy.children?.[0].id).not.toBe(store.page.children[0].children?.[0].id);
  });

  it("不允许把容器拖进自己的子孙", () => {
    const { store } = freshStore();
    store.addNode("card");
    const cardId = store.page.children[0].id;
    store.addNode("grid", cardId, "inside");
    const gridId = store.page.children[0].children?.[0].id as string;

    store.relocate(cardId, gridId, "inside");
    expect(store.page.children).toHaveLength(1);
    expect(store.page.children[0].id).toBe(cardId);
  });

  it("点击物料时优先放进选中的容器", () => {
    const { store } = freshStore();
    store.addNode("card");
    const cardId = store.page.children[0].id;
    store.select(cardId);
    store.addNodeSmart("input");
    expect(store.page.children).toHaveLength(1);
    expect(store.page.children[0].children?.[0].component).toBe("input");
  });

  it("保存后 dirty 归零，仓储可读回", () => {
    const { store, page } = freshStore();
    store.addNode("title");
    store.updateProp("text", "标题文案");
    expect(store.dirty).toBe(true);

    store.save();
    expect(store.dirty).toBe(false);

    const record = getPage(page.id);
    expect(record).toBeTruthy();
    expect(record?.schema.children[0].props?.text).toBe("标题文案");
  });

  it("事件动作与指令可增删", () => {
    const { store } = freshStore();
    store.addNode("button");
    store.setEventActions("click", [{ action: "toast", args: { text: "hi" } }]);
    expect(store.selectedNode?.events?.click).toHaveLength(1);

    store.setEventActions("click", []);
    expect(store.selectedNode?.events?.click).toBeUndefined();

    store.setDirective("show", "list.length > 0");
    expect(store.selectedNode?.directives?.[0].value).toBe("list.length > 0");

    store.setDirective("show", "");
    expect(store.selectedNode?.directives).toBeUndefined();
  });

  it("删除节点后选中父级", () => {
    const { store } = freshStore();
    store.addNode("card");
    const cardId = store.page.children[0].id;
    store.addNode("input", cardId, "inside");
    const inputId = store.page.children[0].children?.[0].id as string;
    store.select(inputId);
    store.removeSelected();

    expect(store.page.children[0].children).toHaveLength(0);
    expect(store.selectedId).toBe(cardId);
  });
});

describe("通用间距编辑", () => {
  it("四边统一写简写，分边写长写，清空不留键", () => {
    const { store } = freshStore();
    store.addNode("container");

    store.updateSpacing("padding", { top: "16px", right: "16px", bottom: "16px", left: "16px" });
    expect(store.selectedNode?.style?.padding).toBe("16px");

    store.updateSpacing("padding", { top: "16px", right: "8px", bottom: "16px", left: "8px" });
    expect(store.selectedNode?.style).toMatchObject({ paddingTop: "16px", paddingRight: "8px" });

    store.updateSpacing("padding", { top: "", right: "", bottom: "", left: "" });
    expect(store.selectedNode?.style).toBeUndefined();
  });

  it("间距修改进入撤销栈", () => {
    const { store } = freshStore();
    store.addNode("text");
    store.updateSpacing("margin", { top: "12px", right: "12px", bottom: "12px", left: "12px" });
    expect(store.selectedNode?.style?.margin).toBe("12px");

    store.undo();
    expect(store.selectedNode).toBeNull();
    expect(store.page.children[0].style).toBeUndefined();
  });
});

describe("校验规则编辑", () => {
  beforeEach(() => {
    localStorage.clear();
    setPageRepository(localStorageRepo);
  });

  it("规则写入 node.rules，并把老写法的 props.required 归一掉", () => {
    const { store } = freshStore();
    store.addNode("input");
    store.updateProp("required", true);
    expect(store.selectedNode?.props?.required).toBe(true);

    store.setRules([{ type: "required" }, { type: "maxLength", value: 10 }]);

    expect(store.selectedNode?.rules).toEqual([{ type: "required" }, { type: "maxLength", value: 10 }]);
    expect(store.page.children[0].props).not.toHaveProperty("required");
  });

  it("清空规则时删除该键，保持 JSON 最小", () => {
    const { store } = freshStore();
    store.addNode("input");
    store.setRules([{ type: "required" }]);
    expect(store.page.children[0].rules).toHaveLength(1);

    store.setRules([]);
    expect(store.page.children[0]).not.toHaveProperty("rules");
  });

  it("规则改动进撤销栈", () => {
    const { store } = freshStore();
    store.addNode("input");
    store.setRules([{ type: "email" }]);

    store.undo();
    expect(store.page.children[0]).not.toHaveProperty("rules");
  });

  it("非法规则在写入时被过滤", () => {
    const { store } = freshStore();
    store.addNode("input");
    store.setRules([
      { type: "required" },
      { type: "not-exist" } as never,
      { type: "maxLength", value: Number.NaN },
    ]);

    expect(store.page.children[0].rules?.map((rule) => rule.type)).toEqual(["required", "maxLength"]);
  });
});
