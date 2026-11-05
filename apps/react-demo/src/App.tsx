import { useRef, useState } from "react";
import { SchemaRenderer } from "@x-ac/design-react";
import type { SchemaRendererHandle } from "@x-ac/design-react";
import { toDataJSON, toHtml, toJSON } from "@x-ac/design-core";
import type { NodeSchema, PageSchema } from "@x-ac/design-core";
import { createDemoPage } from "./page";

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

export default function App() {
  const [page, setPage] = useState<PageSchema>(createDemoPage);
  const [mountKey, setMountKey] = useState(0);
  const [gap, setGap] = useState(12);
  const [report, setReport] = useState("");
  const [reportValid, setReportValid] = useState<boolean | null>(null);
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

  return (
    <div className="demo">
      <aside className="demo__panel">
        <h1>React 示例</h1>
        <p className="demo__desc">
          组件只管渲染，不负责路由与页面切换；这里的「重置视图 / 导出」都是示例宿主自己的事。
        </p>

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
            <button onClick={() => download("react-demo.html", toHtml(page), "text/html")}>
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
          navigate={(to) => console.info("[demo] navigate:", to)}
          style={{ maxWidth: 780 }}
        />
      </main>
    </div>
  );
}
