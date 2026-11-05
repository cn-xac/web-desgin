/**
 * 受限表达式求值层。
 * 硬约束：不使用 eval / new Function；白名单语法；失败返回 undefined 并 warn，不抛错。
 *
 * 支持语法：
 *   - 标识符与路径：form.name、list[0].label、list.length
 *   - 字面量：'字符串' / "字符串" / 12 / 1.5 / true / false / null / undefined
 *   - 运算：! && || == === != !== > >= < <= + - * / %
 *   - 三元：cond ? a : b
 *   - 括号
 * 明确不支持：函数调用、new、赋值、可选链、模板字符串、正则。
 */

export type Scope = Record<string, unknown>;

type TokenType = "num" | "str" | "ident" | "op" | "punc" | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

type Ast =
  | { t: "lit"; v: unknown }
  | { t: "id"; name: string }
  | { t: "member"; obj: Ast; key: Ast; computed: boolean }
  | { t: "unary"; op: string; arg: Ast }
  | { t: "binary"; op: string; l: Ast; r: Ast }
  | { t: "cond"; test: Ast; cons: Ast; alt: Ast };

/** 访问这些键一律返回 undefined，防止原型链逃逸 */
const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "window",
  "globalThis",
  "document",
  "eval",
  "Function",
  "process",
  "require",
  "self",
  "top",
  "global",
  "localStorage",
  "location",
]);

/** 允许作为 id 的保留字面量（用 Map，避免 `in` 沿原型链误判 constructor / toString） */
const LITERAL_WORDS = new Map<string, unknown>([
  ["true", true],
  ["false", false],
  ["null", null],
  ["undefined", undefined],
]);

const OPERATORS = [
  "===",
  "!==",
  "==",
  "!=",
  ">=",
  "<=",
  "&&",
  "||",
  ">",
  "<",
  "!",
  "+",
  "-",
  "*",
  "/",
  "%",
  "?",
  ":",
];

const PUNCTUATORS = ["(", ")", "[", "]", ".", ",", "{", "}"];

export class ExpressionError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // 字符串
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = "";
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        const c = input[j];
        if (c === "\\") {
          const next = input[j + 1];
          value += next === "n" ? "\n" : next === "t" ? "\t" : next ?? "";
          j += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          j += 1;
          break;
        }
        value += c;
        j += 1;
      }
      if (!closed) throw new ExpressionError(`未闭合的字符串，位置 ${i}`);
      tokens.push({ type: "str", value, pos: i });
      i = j;
      continue;
    }

    // 数字
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9]/.test(input[j])) j += 1;
      if (input[j] === "." && /[0-9]/.test(input[j + 1] ?? "")) {
        j += 1;
        while (j < input.length && /[0-9]/.test(input[j])) j += 1;
      }
      tokens.push({ type: "num", value: input.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // 标识符
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_$]/.test(input[j])) j += 1;
      tokens.push({ type: "ident", value: input.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // 操作符（最长匹配）
    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op) {
      tokens.push({ type: "op", value: op, pos: i });
      i += op.length;
      continue;
    }

    // 标点
    if (PUNCTUATORS.includes(ch)) {
      tokens.push({ type: "punc", value: ch, pos: i });
      i += 1;
      continue;
    }

    throw new ExpressionError(`非法字符 "${ch}"，位置 ${i}`);
  }

  tokens.push({ type: "eof", value: "", pos: input.length });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private index = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private eat(value: string): boolean {
    if (this.peek().value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expect(value: string): void {
    if (!this.eat(value)) {
      throw new ExpressionError(`期望 "${value}"，实际 "${this.peek().value || "EOF"}"`);
    }
  }

  parse(): Ast {
    const ast = this.parseTernary();
    if (this.peek().type !== "eof") {
      throw new ExpressionError(`多余的字符 "${this.peek().value}"`);
    }
    return ast;
  }

  private parseTernary(): Ast {
    const test = this.parseBinary(0);
    if (this.eat("?")) {
      const cons = this.parseTernary();
      this.expect(":");
      const alt = this.parseTernary();
      return { t: "cond", test, cons, alt };
    }
    return test;
  }

  /** 优先级表：0 最低 */
  private static readonly LEVELS: string[][] = [
    ["||"],
    ["&&"],
    ["===", "!==", "==", "!="],
    [">", ">=", "<", "<="],
    ["+", "-"],
    ["*", "/", "%"],
  ];

  private parseBinary(level: number): Ast {
    if (level >= Parser.LEVELS.length) return this.parseUnary();
    let left = this.parseBinary(level + 1);
    for (;;) {
      const ops = Parser.LEVELS[level];
      const token = this.peek();
      if (token.type === "op" && ops.includes(token.value)) {
        this.next();
        const right = this.parseBinary(level + 1);
        left = { t: "binary", op: token.value, l: left, r: right };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Ast {
    const token = this.peek();
    if (token.type === "op" && (token.value === "!" || token.value === "-" || token.value === "+")) {
      this.next();
      return { t: "unary", op: token.value, arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Ast {
    let node = this.parsePrimary();
    for (;;) {
      if (this.eat(".")) {
        const token = this.peek();
        if (token.type !== "ident" && token.type !== "num") {
          throw new ExpressionError("成员访问后必须是属性名");
        }
        this.next();
        node = { t: "member", obj: node, key: { t: "lit", v: token.value }, computed: false };
        continue;
      }
      if (this.eat("[")) {
        const key = this.parseTernary();
        this.expect("]");
        node = { t: "member", obj: node, key, computed: true };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): Ast {
    const token = this.next();

    if (token.type === "num") return { t: "lit", v: Number(token.value) };
    if (token.type === "str") return { t: "lit", v: token.value };

    if (token.type === "ident") {
      if (LITERAL_WORDS.has(token.value)) return { t: "lit", v: LITERAL_WORDS.get(token.value) };
      if (FORBIDDEN_KEYS.has(token.value)) {
        throw new ExpressionError(`禁止访问 "${token.value}"`);
      }
      return { t: "id", name: token.value };
    }

    if (token.value === "(") {
      const inner = this.parseTernary();
      this.expect(")");
      return inner;
    }

    throw new ExpressionError(`无法解析的记号 "${token.value || "EOF"}"`);
  }
}

const astCache = new Map<string, Ast | null>();

function parseCached(source: string): Ast | null {
  if (astCache.has(source)) return astCache.get(source) ?? null;
  try {
    const ast = new Parser(source).parse();
    astCache.set(source, ast);
    return ast;
  } catch (error) {
    warnOnce(`表达式解析失败: ${source} -> ${(error as Error).message}`);
    astCache.set(source, null);
    return null;
  }
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  if (typeof console !== "undefined") console.warn(`[vue-design][expression] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function evaluateAst(ast: Ast, scope: Scope): unknown {
  switch (ast.t) {
    case "lit":
      return ast.v;

    case "id":
      return FORBIDDEN_KEYS.has(ast.name) ? undefined : scope[ast.name];

    case "member": {
      const obj = evaluateAst(ast.obj, scope);
      if (obj === null || obj === undefined) return undefined;
      const key = evaluateAst(ast.key, scope);
      const keyStr = String(key);
      if (FORBIDDEN_KEYS.has(keyStr)) return undefined;
      if (typeof obj === "string") {
        if (keyStr === "length") return obj.length;
        const idx = Number(keyStr);
        return Number.isInteger(idx) ? obj[idx] : undefined;
      }
      if (Array.isArray(obj)) {
        if (keyStr === "length") return obj.length;
        const idx = Number(keyStr);
        // 只允许索引，禁止把数组方法暴露给表达式
        return Number.isInteger(idx) ? obj[idx] : undefined;
      }
      if (isRecord(obj)) return (obj as Record<string, unknown>)[keyStr];
      return undefined;
    }

    case "unary": {
      const arg = evaluateAst(ast.arg, scope);
      if (ast.op === "!") return !arg;
      if (ast.op === "-") return typeof arg === "number" ? -arg : undefined;
      if (ast.op === "+") return typeof arg === "number" ? arg : undefined;
      return undefined;
    }

    case "binary": {
      // 短路运算先求左值
      if (ast.op === "&&") {
        const left = evaluateAst(ast.l, scope);
        return left ? evaluateAst(ast.r, scope) : left;
      }
      if (ast.op === "||") {
        const left = evaluateAst(ast.l, scope);
        return left ? left : evaluateAst(ast.r, scope);
      }
      const l = evaluateAst(ast.l, scope);
      const r = evaluateAst(ast.r, scope);
      switch (ast.op) {
        case "===":
          return l === r;
        case "!==":
          return l !== r;
        case "==":
          // eslint-disable-next-line eqeqeq
          return l == r;
        case "!=":
          // eslint-disable-next-line eqeqeq
          return l != r;
        case ">":
          return (l as number) > (r as number);
        case ">=":
          return (l as number) >= (r as number);
        case "<":
          return (l as number) < (r as number);
        case "<=":
          return (l as number) <= (r as number);
        case "+":
          if (typeof l === "number" && typeof r === "number") return l + r;
          if (typeof l === "string" || typeof r === "string") return `${l ?? ""}${r ?? ""}`;
          return undefined;
        case "-":
          return typeof l === "number" && typeof r === "number" ? l - r : undefined;
        case "*":
          return typeof l === "number" && typeof r === "number" ? l * r : undefined;
        case "/":
          return typeof l === "number" && typeof r === "number" ? l / r : undefined;
        case "%":
          return typeof l === "number" && typeof r === "number" ? l % r : undefined;
        default:
          return undefined;
      }
    }

    case "cond":
      return evaluateAst(ast.test, scope) ? evaluateAst(ast.cons, scope) : evaluateAst(ast.alt, scope);

    default:
      return undefined;
  }
}

/** 求值单条表达式；任何失败都返回 undefined，不抛错 */
export function evaluate(expression: string, scope: Scope = {}): unknown {
  const source = expression.trim();
  if (!source) return undefined;
  const ast = parseCached(source);
  if (!ast) return undefined;
  try {
    return evaluateAst(ast, scope);
  } catch (error) {
    warnOnce(`表达式求值失败: ${source} -> ${(error as Error).message}`);
    return undefined;
  }
}

const FULL_INTERPOLATION = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
const INLINE_INTERPOLATION = /\{\{([\s\S]+?)\}\}/g;

/**
 * 解析属性值：
 * - 整串只有一个 {{}} 时返回原始类型（数组、布尔、数字都能透传）
 * - 混排文本时替换成字符串
 * - 非字符串原样返回
 */
export function resolveValue(value: unknown, scope: Scope): unknown {
  if (typeof value !== "string") return value;
  if (!value.includes("{{")) return value;

  const full = FULL_INTERPOLATION.exec(value);
  if (full) return evaluate(full[1], scope);

  return value.replace(INLINE_INTERPOLATION, (_match, expr: string) => {
    const result = evaluate(expr, scope);
    return result === undefined || result === null ? "" : String(result);
  });
}

/** 求布尔：用于 show / if 指令 */
export function resolveBoolean(value: unknown, scope: Scope): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    // 指令值允许写成裸表达式（不带 {{}}）
    const raw = FULL_INTERPOLATION.test(trimmed) ? resolveValue(trimmed, scope) : evaluate(trimmed, scope);
    return Boolean(raw);
  }
  return Boolean(value);
}

/** 深拷贝并按路径写入（用于 v-model 回写 scope） */
export function getByPath(scope: Scope, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = scope;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (FORBIDDEN_KEYS.has(key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setByPath(scope: Scope, path: string, value: unknown): boolean {
  const keys = path.split(".").filter(Boolean);
  if (!keys.length || keys.some((k) => FORBIDDEN_KEYS.has(k))) return false;
  let current: Record<string, unknown> = scope;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = current[key];
    if (next === null || typeof next !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return true;
}

/** 从绑定字符串里取出路径；非绑定返回 null */
export function extractPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = FULL_INTERPOLATION.exec(value);
  if (!match) return null;
  const inner = match[1].trim();
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(inner) ? inner : null;
}
