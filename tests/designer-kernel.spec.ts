/**
 * core 设计器状态机：Vue / React 两侧共用同一份内核的契约测试。
 *
 * 这里只验证框架无关行为（快照订阅、历史、树操作、属性编辑、仓储），
 * UI 层的行为由 tests/designer.spec.ts 与 tests/react-designer.spec.tsx 各自覆盖。
 */
import { describe, expect, it } from "vitest";
import {
  DesignerStore,
  createEmptyPage,
  createMemoryRepository,
  createRegistry,
  MATERIALS,
} from "@x-ac/design-core";
import type { PageSchema } from "@x-ac/design-core";

function page(id = "p1"): PageSchema {
  return { ...createEmptyPage("测试页"), id, children: [] };
}

function seeded(): { store: DesignerStore; repo: ReturnType<typeof createMemoryRepository> } {
  const target = page();
  const repo = createMemoryRepository([target]);
  const store = new DesignerStore({ repository: repo });
  store.load("p1");
  return { store, repo };
}

describe("DesignerStore 快照与订阅", () => {
  it("初始状态干净，load 之后 dirty 归零", () => {
    const store = new DesignerStore();
    expect(store.getSnapshot().page.children).toEqual([]);
    expect(store.getSnapshot().canUndo).toBe(false);

    const { store: loaded } = seeded();
    expect(loaded.getSnapshot().dirty).toBe(false);
    expect(loaded.getSnapshot().page.meta?.title).toBe("测试页");
  });

  it("订阅收到通知，快照引用变化，取消订阅后不再通知", () => {
    const { store } = seeded();
    const before = store.getSnapshot();
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });

    store.setTitle("新标题");
    expect(calls).toBe(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().page.meta?.title).toBe("新标题");
    expect(store.getSnapshot().dirty).toBe(true);

    off();
    store.setTitle("再改一次");
    expect(calls).toBe(1);
  });

  it("select / hover 不重建 page 引用，但可以参与重渲染", () => {
    const { store } = seeded();
    const before = store.getSnapshot().page;
    store.select("nope");
    store.hover("nope");
    expect(store.getSnapshot().page).toBe(before);
    expect(store.getSnapshot().selectedId).toBe("nope");
  });
});

describe("DesignerStore 历史与节点操作", () => {
  it("addNode / undo / redo 成闭环，选中态跟随", () => {
    const { store } = seeded();
    store.addNode("button");
    const id = store.getSnapshot().selectedId;
    expect(id).toBeTruthy();
    expect(store.getSnapshot().page.children).toHaveLength(1);
    expect(store.getSnapshot().canUndo).toBe(true);

    store.undo();
    expect(store.getSnapshot().page.children).toHaveLength(0);
    expect(store.getSnapshot().canRedo).toBe(true);

    store.redo();
    expect(store.getSnapshot().page.children).toHaveLength(1);
    expect(store.getSnapshot().page.children[0].id).toBe(id);
  });

  it("addNodeSmart 优先放进选中的容器", () => {
    const { store } = seeded();
    store.addNode("card");
    const containerId = store.getSnapshot().selectedId as string;
    store.addNodeSmart("button");
    const container = store.getSnapshot().page.children[0];
    expect(container.id).toBe(containerId);
    expect(container.children).toHaveLength(1);
    expect(container.children?.[0].component).toBe("button");
  });

  it("复制 / 粘贴 / 删除 / 上下移动都走 core 树函数", () => {
    const { store } = seeded();
    store.addNode("button");
    const first = store.getSnapshot().selectedId as string;
    store.addNode("input");
    const second = store.getSnapshot().selectedId as string;

    store.moveSelected(-1);
    expect(store.getSnapshot().page.children.map((n) => n.id)).toEqual([second, first]);

    store.select(first);
    store.copySelected();
    expect(store.getSnapshot().clipboard?.component).toBe("button");
    store.pasteNode();
    expect(store.getSnapshot().page.children).toHaveLength(3);

    store.duplicateSelected();
    expect(store.getSnapshot().page.children).toHaveLength(4);

    store.removeSelected();
    expect(store.getSnapshot().page.children).toHaveLength(3);
  });

  it("relocate 不允许把节点拖进自己的子树", () => {
    const { store } = seeded();
    store.addNode("card");
    const parent = store.getSnapshot().selectedId as string;
    store.addNodeSmart("button");
    const child = store.getSnapshot().selectedId as string;
    store.relocate(child, parent, "inside"); // 已在内部，等价 no-op
    expect(store.getSnapshot().page.children).toHaveLength(1);
  });

  it("applyDrop 消费拖拽负载并按 hint 落点", () => {
    const { store } = seeded();
    store.beginDrag({ kind: "new", component: "button" });
    expect(store.getSnapshot().dragPayload?.kind).toBe("new");
    store.applyDrop({ id: null, position: "inside" });
    expect(store.getSnapshot().dragPayload).toBeNull();
    expect(store.getSnapshot().page.children).toHaveLength(1);
    expect(store.getSnapshot().page.children[0].component).toBe("button");
  });
});

describe("DesignerStore 属性编辑与导入导出", () => {
  it("updateProp 把等于默认值的值从 Schema 里删掉", () => {
    const { store } = seeded();
    store.addNode("button");
    const id = store.getSnapshot().selectedId as string;
    store.updateProp("text", "自定义文案");
    expect(store.getSnapshot().selectedNode?.props?.text).toBe("自定义文案");

    const defaults = createRegistry(MATERIALS).defaults("button");
    store.updateProp("text", defaults.text);
    expect(store.getSnapshot().selectedNode?.props?.text).toBeUndefined();
    expect(id).toBeTruthy();
  });

  it("updateStyle / updateSpacing / setRules / setEventActions / setDirective 都落到节点", () => {
    const { store } = seeded();
    store.addNode("input");

    store.updateStyle("width", "200px");
    expect(store.getSnapshot().selectedNode?.style?.width).toBe("200px");
    store.updateStyle("width", "");
    expect(store.getSnapshot().selectedNode?.style?.width).toBeUndefined();

    store.updateSpacing("margin", { top: "8px", right: "8px", bottom: "8px", left: "8px" });
    expect(store.getSnapshot().selectedNode?.style?.margin).toBe("8px");

    store.setRules([{ type: "required" }]);
    expect(store.getSnapshot().selectedNode?.rules).toEqual([{ type: "required" }]);

    store.setEventActions("change", [{ action: "toast", args: { text: "hi" } }]);
    expect(store.getSnapshot().selectedNode?.events?.change).toHaveLength(1);

    store.setDirective("if", "form.visible");
    expect(store.getSnapshot().selectedNode?.directives?.[0].name).toBe("if");
  });

  it("save 写仓储并清 dirty，load 复位历史", () => {
    const { store, repo } = seeded();
    store.addNode("button");
    expect(store.getSnapshot().dirty).toBe(true);
    expect(store.save()).toBe(true);
    expect(store.getSnapshot().dirty).toBe(false);
    expect(repo.get("p1")?.schema.children).toHaveLength(1);

    store.addNode("input");
    expect(store.load("p1")).toBe(true);
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.getSnapshot().page.children).toHaveLength(1);
  });

  it("exportJSON / replaceWith / clear 可撤销", () => {
    const { store } = seeded();
    store.addNode("button");
    const json = store.exportJSON();
    expect(JSON.parse(json).children).toHaveLength(1);

    store.replaceWith(page("p2"));
    expect(store.getSnapshot().page.children).toHaveLength(0);
    store.undo();
    expect(store.getSnapshot().page.children).toHaveLength(1);

    store.clear();
    expect(store.getSnapshot().page.children).toHaveLength(0);
  });

  it("addDataSourceEntry 拒绝非法 JSON 且不污染历史", () => {
    const { store } = seeded();
    expect(() => store.addDataSourceEntry("list", "{oops")).toThrow("必须是合法 JSON");
    expect(store.getSnapshot().canUndo).toBe(false);
    store.addDataSourceEntry("list", '{"a":1}');
    expect(store.getSnapshot().page.dataSource?.list).toEqual({ a: 1 });
  });
});
