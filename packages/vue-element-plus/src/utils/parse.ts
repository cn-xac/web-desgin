/**
 * 成对内容的解析工具。
 *
 * 为什么用字符串而不是结构化编辑器：折叠面板、标签页、步骤条这类组件的价值全在
 * 「有多少项、每项写什么」。给每项做一套增删编辑器，面板会变成半个表格编辑器，
 * 而用户真正想要的只是「填几行字」。字符串在 Schema 里也可读、可 diff、可手写。
 */

export interface PairItem {
  label: string;
  value: string;
}

/** 中英文逗号、分号都当分隔符：用户不会记得只能写英文逗号 */
const ENTRY_SPLIT = /[,，;；\n]/;
const PAIR_SPLIT = /[:：]/;

/**
 * 解析 `标签:值` 列表。
 * - `标题:内容` → [{ label: "标题", value: "内容" }]
 * - `只有一项` → [{ label: "只有一项", value: "" }]
 * 值里允许再出现冒号（只按第一个冒号切），URL、时间戳都能正常用。
 */
export function parsePairs(raw: unknown): PairItem[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return { label: String(record.label ?? record.title ?? ""), value: String(record.value ?? record.content ?? "") };
    });
  }
  if (typeof raw !== "string" || !raw.trim()) return [];

  return raw
    .split(ENTRY_SPLIT)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.search(PAIR_SPLIT);
      if (at < 0) return { label: entry, value: "" };
      return { label: entry.slice(0, at).trim(), value: entry.slice(at + 1).trim() };
    });
}

/** 只要标签（面包屑、分段控制器这类只需要一项文字） */
export function parseLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw !== "string") return [];
  return raw
    .split(ENTRY_SPLIT)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
}

/**
 * 解析层级路径成树，给级联选择 / 树选择用。
 *
 * 写法：每行一条路径，`/` 或 `>` 分层
 * ```
 * 华东/上海/浦东
 * 华东/上海/徐汇
 * 华南/广州
 * ```
 * 重复的中间节点自动合并 —— 手写路径时没人愿意写三遍「华东」。
 */
export function parsePaths(raw: unknown): TreeNode[] {
  const lines =
    typeof raw === "string"
      ? raw.split(/\n/).map((line) => line.trim()).filter(Boolean)
      : [];

  const roots: TreeNode[] = [];
  const index = new Map<string, TreeNode>();

  for (const line of lines) {
    const parts = line.split(/[/>]/).map((part) => part.trim()).filter(Boolean);
    let parentChildren = roots;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let node = index.get(path);
      if (!node) {
        node = { value: path, label: part };
        index.set(path, node);
        parentChildren.push(node);
      }
      if (!node.children) node.children = [];
      parentChildren = node.children;
    }
  }

  // 叶子节点不留空 children，否则级联选择会画出可展开但没内容的箭头
  const prune = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((node) => {
      if (!node.children?.length) return { value: node.value, label: node.label };
      return { ...node, children: prune(node.children) };
    });

  return prune(roots);
}

/** `a,b,c` → ["a","b","c"]，给多选类选项用 */
export function parseList(raw: unknown): string[] {
  return parseLabels(raw);
}
