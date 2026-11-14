/**
 * 静态 HTML 导出（服务端 / 无框架环境）。
 *
 * 存在意义不只是「导出文件」：它证明 PageSchema + core 不依赖 Vue，
 * 同一份 JSON 在 Node 里就能直出 HTML。React 渲染器将来只需等价地实现一次节点映射。
 */

import type { NodeSchema, PageSchema } from "../schema/types";
import { resolveValue } from "../schema/expression";
import { resolveLoopInstances, resolveVisibility } from "../visibility/evaluate";
import { registry as globalRegistry } from "../materials/catalog";
import type { MaterialRegistry } from "../materials/registry";
import type { Material } from "../materials/types";
import { bareKey } from "../materials/keys";
import { resolveNodeStyle, styleToCssText, kebab } from "../style/style";
import { isRequired } from "../validation/rules";

export interface HtmlExportOptions {
  /** 覆盖页面标题 */
  title?: string;
  lang?: string;
  /** 页面级状态，用于解析 {{}} 表达式 */
  state?: Record<string, unknown>;
  /** 追加的全局 CSS */
  css?: string;
  /**
   * 物料目录：适配包 + 业务物料。不传则用全局 registry。
   * 传了之后，适配包追加的 `defaultStyle` 与业务物料的元数据在静态导出里同样生效。
   */
  materials?: MaterialRegistry;
}

type Scope = Record<string, unknown>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleAttr(
  component: string,
  props: Record<string, unknown>,
  style: Record<string, unknown> | undefined,
  scope: Scope,
  material?: Material,
): string {
  const css = resolveNodeStyle(component, props, style, (value) => resolveValue(value, scope), material);
  const text = styleToCssText(css);
  return text ? ` style="${escapeHtml(text)}"` : "";
}

function textOf(value: unknown, scope: Scope): string {
  return String(resolveValue(value, scope) ?? "");
}

const FORM_TAGS: Record<string, string> = {
  input: "input",
  textarea: "textarea",
  number: "input",
  select: "select",
  date: "input",
  switch: "input",
  rate: "input",
  slider: "input",
};

/** 表单控件直出为原生控件，保证导出的页面仍可输入（不接动作） */
function renderField(node: NodeSchema, materialTitle: string, props: Record<string, unknown>, scope: Scope, style: string): string {
  const label = textOf(props.label ?? materialTitle, scope);
  const requiredField = isRequired(node, props);
  const required = requiredField ? " required" : "";
  const tag = FORM_TAGS[bareKey(node.component)] ?? "input";
  const placeholder = props.placeholder ? ` placeholder="${escapeHtml(textOf(props.placeholder, scope))}"` : "";

  let control: string;
  if (tag === "select") {
    const options = String(props.options ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join("");
    control = `<select${style}${required}>${options}</select>`;
  } else if (tag === "textarea") {
    control = `<textarea${style}${placeholder}${required}></textarea>`;
  } else {
    const bare = bareKey(node.component);
    const type = bare === "number" ? "number" : bare === "date" ? "date" : "text";
    control = `<input type="${type}"${style}${placeholder}${required} />`;
  }

  return `<label class="ux-field"><span class="ux-field__label">${escapeHtml(label)}${requiredField ? '<i class="ux-req">*</i>' : ""}</span>${control}</label>`;
}

function renderTable(props: Record<string, unknown>, scope: Scope, style: string): string {
  const rows = resolveValue(props.modelValue ?? props.rows ?? props.data, scope);
  const list = Array.isArray(rows) ? rows : [];
  const columns = String(props.columns ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
  const body = list
    .map((row) => {
      const record = (row ?? {}) as Record<string, unknown>;
      const cells = columns.map((col) => `<td>${escapeHtml(String(record[col] ?? ""))}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="ux-table"${style}><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${Math.max(1, columns.length)}">暂无数据</td></tr>`}</tbody></table>`;
}

function renderNode(node: NodeSchema, scope: Scope, materials: MaterialRegistry): string {
  // 显隐判定与运行时共用 core 契约（含新 visibility 配置与旧 directives 回落）
  const decision = resolveVisibility(node, scope);
  if (!decision.visible && decision.mode === "if") return "";

  const instances = resolveLoopInstances(node, scope);
  if (instances) {
    return instances
      .map((instance) =>
        renderNode(
          { ...node, directives: (node.directives ?? []).filter((d) => d.name !== "for") },
          instance.scope,
          materials,
        ),
      )
      .join("");
  }

  const material = materials.get(node.component);
  const props = materials.defaults(node.component, node.props);
  const hidden = !decision.visible && decision.mode !== "if";
  const style = styleAttr(node.component, props, node.style, scope, material) || (hidden ? ' style="display:none"' : "");
  const styleWithHidden = hidden && !style.includes("display:none") ? `${style.replace(/"$/, "")}${style ? ";" : ' style="'}display:none"` : style;
  const children = (node.children ?? []).map((child) => renderNode(child, scope, materials)).join("");
  const title = material?.title ?? node.component;

  switch (bareKey(node.component)) {
    case "text":
      return `<p${styleWithHidden}>${escapeHtml(textOf(props.text, scope))}</p>`;
    case "title":
      return `<h3${styleWithHidden}>${escapeHtml(textOf(props.text, scope))}</h3>`;
    case "divider":
      return `<hr${styleWithHidden} />`;
    case "tag":
      return `<span class="ux-tag"${styleWithHidden}>${escapeHtml(textOf(props.text, scope))}</span>`;
    case "alert":
      return `<div class="ux-alert"${styleWithHidden}>${escapeHtml(textOf(props.title ?? props.text, scope))}</div>`;
    case "image":
      return `<img src="${escapeHtml(String(props.src ?? ""))}" alt="${escapeHtml(String(props.alt ?? ""))}"${styleWithHidden} />`;
    case "button":
      return `<button class="ux-button"${styleWithHidden}>${escapeHtml(textOf(props.text ?? props.label, scope))}</button>`;
    case "link":
      return `<a class="ux-link" href="${escapeHtml(String(props.href ?? "#"))}"${styleWithHidden}>${escapeHtml(textOf(props.text, scope))}</a>`;
    case "table":
      return renderTable(props, scope, styleWithHidden);
    case "card":
      return `<section class="ux-card"${styleWithHidden}><div class="ux-card__header">${escapeHtml(textOf(props.title, scope))}</div><div class="ux-card__body">${children}</div></section>`;
    case "container":
    case "grid":
    case "space":
      return `<div${styleWithHidden}>${children}</div>`;
    default:
      break;
  }

  // 不可移植的物料（业务自研组件）在静态导出里无从渲染：
  // 拿原生 input 冒充它比给占位更糟——占位至少诚实，不会让人以为导出的能直接用。
  if (material && !material.portable) {
    return `<div class="ux-unknown"${styleWithHidden} data-component="${escapeHtml(node.component)}">${escapeHtml(title)}（业务物料，不可静态导出）</div>`;
  }

  if (material?.kind === "field") {
    return renderField(node, title, props, scope, styleWithHidden);
  }

  return `<div class="ux-unknown"${styleWithHidden} data-component="${escapeHtml(node.component)}">${children || escapeHtml(title)}</div>`;
}

const BASE_CSS = `
*{box-sizing:border-box}
body{margin:0;padding:24px;background:#f4f5f7;color:#1f2430;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.ux-page{max-width:960px;margin:0 auto;background:#fff;border:1px solid #e4e7ed;border-radius:10px;padding:24px}
.ux-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.ux-field__label{font-size:13px;color:#5c6373}
.ux-req{color:#f56c6c;font-style:normal;margin-left:3px}
.ux-field input,.ux-field select,.ux-field textarea{width:100%;padding:7px 10px;border:1px solid #dcdfe6;border-radius:5px;font:inherit;background:#fff}
.ux-button{padding:8px 16px;border:0;border-radius:5px;background:#2f4bff;color:#fff;font:inherit;cursor:pointer}
.ux-tag{display:inline-block;padding:1px 7px;border-radius:4px;background:#eef1ff;color:#2f4bff;font-size:12px}
.ux-alert{padding:10px 12px;border-radius:6px;background:#f4f8ff;border:1px solid #d9e3ff;color:#33508f}
.ux-card{border:1px solid #eef0f4;border-radius:8px;padding:16px;background:#fff}
.ux-card__header{font-weight:600;margin-bottom:12px}
.ux-table{width:100%;border-collapse:collapse}
.ux-table th,.ux-table td{border-bottom:1px solid #eef0f4;padding:8px 10px;text-align:left;font-size:13px}
.ux-table th{background:#fafbfd;color:#5c6373;font-weight:600}
.ux-unknown{padding:10px;border:1px dashed #f56c6c;border-radius:6px;color:#f56c6c}
`.trim();

/** PageSchema → 可独立打开的 HTML 文档 */
export function toHtml(page: PageSchema, options: HtmlExportOptions = {}): string {
  const scope: Scope = { ...(page.state ?? {}), ...(options.state ?? {}) };
  const materials = options.materials ?? globalRegistry;
  const title = options.title ?? String(page.meta?.title ?? "页面");
  const body = page.children.map((node) => renderNode(node, scope, materials)).join("\n");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang ?? "zh-CN")}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
${BASE_CSS}
${options.css ?? ""}
</style>
</head>
<body>
<div class="ux-page">
${body}
</div>
</body>
</html>`;
}

/** 导出为 CSS 变量/类片段，供设计令牌复用 */
export function styleToRule(selector: string, style: Record<string, unknown>): string {
  const css = resolveNodeStyle("div", {}, style);
  const body = Object.entries(css)
    .map(([key, value]) => `  ${kebab(key)}: ${value};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}
