import { useRef, useState } from "react";
import { SchemaRenderer } from "@x-ac/design-react";
import type { SchemaRendererHandle } from "@x-ac/design-react";
import { SchemaDesigner } from "@x-ac/design-react/designer";
import { toDataJSON, toHtml, toJSON } from "@x-ac/design-core";
import type { NodeSchema, PageRepository, PageSchema } from "@x-ac/design-core";
import { createRegistry } from "@x-ac/design-core";
import { demoAdapter } from "./adapter";
import { createDemoPage } from "./page";

/** 静态导出也要认业务物料：目录由宿主适配包建一次，别在点击回调里反复建表 */
const demoCatalog = createRegistry(demoAdapter.materials);

/**
 * 把一个业务物料节点插进表单卡片。
 *
 * 刻意不放进 createDemoPage()：那份页面要和 Vue 示例逐字一致（跨框架用例在比对），
 * 而 biz-priority 只有 React 侧注册了实现。
 */
function withPriorityNode(page: PageSchema): PageSchema {
  return {
    ...page,
    children: page.children.map((node) =>
      node.id === "rt_card"
        ? {
            ...node,
            children: [
              ...(node.children ?? []),
              {
                id: "rt_priority",
                component: "biz-priority",
                props: { level: "高" },
              },
            ],
          }
        : node,
    ),
  };
}

/** 在示例里演示「通用间距」：直接改 Schema 的 style，渲染立即生效 */
function patchNode(page: PageSchema, id: string, patch: Partial<NodeSchema>): PageSchema {
  return {
    ...page,
    children: page.children.map((node) => (node.id === id ? { ...node, ...patch } : node)),
  };
}

function patchCardChildren(page: PageSchema, cardId: string, gap: number): PageSchema {
  return {
    ...page,
    children: page.children.map((node) => {
      if (node.id !== cardId) return node;
      return {
        ...node,
        children: (node.children ?? []).map((child) =>
          child.component === "space"
            ? child
            : { ...child, style: { ...(child.style ?? {}), marginBottom: `${gap}px` } },
        ),
      };
    }),
  };
}

const GAPS = [0, 8, 12, 16, 24];

const DESIGNER_PAGE_ID = "react-demo";

/** 设计器示例用 localStorage 当仓储：刷新不丢，单测里换内存实现即可 */
const demoRepository: PageRepository = {
  list: () => {
    const raw = localStorage.getItem(DESIGNER_PAGE_ID);
    if (!raw) return [];
    try {
      return [{ id: DESIGNER_PAGE_ID, schema: JSON.parse(raw) as PageSchema, updatedAt: Date.now() }];
    } catch {
      return [];
    }
  },
  get: (id) => {
    const raw = localStorage.getItem(DESIGNER_PAGE_ID);
    if (raw) {
      try {
        return { id, schema: JSON.parse(raw) as PageSchema, updatedAt: Date.now() };
      } catch {
        /* 坏数据回落种子页，不让设计器白屏 */
      }
    }
    return { id, schema: { ...createDemoPage(), id }, updatedAt: Date.now() };
  },
  save: (schema) => {
    localStorage.setItem(DESIGNER_PAGE_ID, JSON.stringify(schema));
    return { id: schema.id, schema, updatedAt: Date.now() };
  },
  remove: (id) => localStorage.removeItem(id),
};

export default function App() {
  const [page, setPage] = useState<PageSchema>(() => withPriorityNode(createDemoPage()));
  const [mountKey, setMountKey] = useState(0);
  const [gap, setGap] = useState(12);
  const [report, setReport] = useState("");
  const [reportValid, setReportValid] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"preview" | "design">("preview");
  const renderer = useRef<SchemaRendererHandle>(null);

  /** 校验：错误会显示到字段下方，这里同时把明细打到右侧面板 */
  function validateAll(): void {
    const result = renderer.current?.getData();
    const ok = renderer.current?.validate() ?? true;
    setReportValid(ok);
    setReport(ok ? `校验通过 · 共 ${result?.fields.length ?? 0} 个字段` : (result?.errors ?? []).map((item) => `· ${item.label}：${item.message}（${item.rule}）`).join("\n"));
  }

  /** 导出：nested 给接口，flat 给表格 / 日志 */
  function exportFormData(): void {
    const result = renderer.current?.getData();
    if (!result) return;
    setReportValid(result.valid);
    setReport(toDataJSON(result, { includeMeta: true }));
  }

  const cardPadding = String(page.children.find((n) => n.id === "rt_card")?.style?.padding ?? "16px");

  function applyPadding(px: number): void {
    setPage((prev) =>
      patchNode(prev, "rt_card", {
        style: { ...(prev.children.find((n) => n.id === "rt_card")?.style ?? {}), padding: `${px}px` },
      }),
    );
  }

  function applyGap(px: number): void {
    setGap(px);
    setPage((prev) => patchCardChildren(prev, "rt_card", px));
  }

  function download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (mode === "design") {
    return (
      <div className="demo__designer">
        <SchemaDesigner
          pageId={DESIGNER_PAGE_ID}
          repository={demoRepository}
          onBack={() => setMode("preview")}
        />
      </div>
    );
  }

  return (
    <div className="demo">
      <aside className="demo__panel">
        <h1>React 示例</h1>
        <p className="demo__desc">
          组件只管渲染，不负责路由与页面切换；这里的「重置视图 / 导出」都是示例宿主自己的事。
        </p>

        <section className="demo__group">
          <h2>模式</h2>
          <div className="demo__chips">
            <button className="is-active">运行预览</button>
            <button onClick={() => setMode("design")}>打开设计器</button>
          </div>
          <p className="demo__desc">
            设计器与 Vue 版共用 core 状态机：拖拽、撤销重做、属性 / 样式 / 规则 / 事件编辑、导入导出与页面保存。
          </p>
        </section>

        <section className="demo__group">
          <h2>通用间距</h2>
          <label className="demo__row">
            <span>卡片 padding</span>
            <input
              type="range"
              min={0}
              max={40}
              step={4}
              value={Number.parseInt(cardPadding, 10) || 0}
              onChange={(event) => applyPadding(Number(event.target.value))}
            />
            <b>{cardPadding}</b>
          </label>
          <div className="demo__chips">
            {GAPS.map((px) => (
              <button key={px} className={px === gap ? "is-active" : ""} onClick={() => applyGap(px)}>
                字段间距 {px}
              </button>
            ))}
          </div>
        </section>

        <section className="demo__group">
          <h2>验证与导出数据</h2>
          <div className="demo__chips">
            <button onClick={validateAll}>验证数据</button>
            <button onClick={exportFormData}>导出数据</button>
          </div>
          {report ? (
            <pre className={`demo__report${reportValid === false ? " is-error" : ""}`}>{report}</pre>
          ) : (
            <p className="demo__desc">点「验证数据」看规则是否通过，点「导出数据」看收集到的表单 JSON。</p>
          )}
        </section>

        <section className="demo__group">
          <h2>导出页面</h2>
          <div className="demo__chips">
            <button onClick={() => download("react-demo.json", toJSON(page), "application/json")}>
              导出 JSON
            </button>
            <button onClick={() => download("react-demo.html", toHtml(page, { materials: demoCatalog }), "text/html")}>
              导出静态 HTML
            </button>
            <button onClick={() => setMountKey((key) => key + 1)}>重置页面数据</button>
          </div>
        </section>

        <section className="demo__group">
          <h2>Schema（实时）</h2>
          <pre className="demo__json">{toJSON(page)}</pre>
        </section>
      </aside>

      <main className="demo__stage">
        <SchemaRenderer
          key={mountKey}
          ref={renderer}
          page={page}
          ui={demoAdapter}
          navigate={(to) => console.info("[demo] navigate:", to)}
          style={{ maxWidth: 780 }}
        />
      </main>
    </div>
  );
}
