/**
 * 校验规则编辑器：规则存在 node.rules，与组件 props 解耦，
 * 同一套规则在 Vue / React / 静态 HTML 下语义一致。
 * 与 Vue 版 RulesEditor.vue 功能对齐，差异只在受控通道 value / onChange。
 */
import { useState } from "react";
import {
  compilePattern,
  effectiveRules,
  getRuleDefinition,
  ruleMessage,
  ruleTypesFor,
} from "@x-ac/design-core";
import type { RuleType, ValidationRule } from "@x-ac/design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

export function RulesEditor() {
  const { store, state, registry } = useDesigner();
  // 「+ 添加规则」下拉的当前选择；选中即添加，随后清空回落到 placeholder
  const [addType, setAddType] = useState<RuleType | "">("");

  // hooks 先调用，再做空态兜底，保证 hooks 顺序稳定
  const node = state.selectedNode;
  if (!node) return null;

  const component = node.component;
  // 有效属性 = 物料默认值 + 节点自身属性；label 用于拼默认提示文案
  const effectiveProps = registry.defaults(component, node.props);
  const label = String(effectiveProps.label ?? "");
  const rules = effectiveRules(node, effectiveProps);
  const required = rules.some((rule) => rule.type === "required");

  /** 可添加的类型：去掉 required 与已存在的类型，避免重复规则 */
  const availableTypes = ruleTypesFor(component)
    .filter((type) => type !== "required" && !rules.some((rule) => rule.type === type))
    .map((type) => ({ value: type, label: getRuleDefinition(type)?.label ?? type }));

  /** 所有写入统一走 store.setRules（整组替换） */
  const commit = (next: ValidationRule[]): void => store.setRules(next);

  const toggleRequired = (value: boolean): void => {
    const rest = rules.filter((rule) => rule.type !== "required");
    commit(value ? [{ type: "required" }, ...rest] : rest);
  };

  /** 按 valueKind 给新规则带上默认值，避免规则值缺省导致运行时语义不明 */
  const makeRule = (type: RuleType): ValidationRule => {
    const definition = getRuleDefinition(type);
    const rule: ValidationRule = { type };
    if (definition?.valueKind === "length") rule.value = type === "minLength" ? 2 : 20;
    if (definition?.valueKind === "number") rule.value = type === "min" ? 0 : 100;
    if (definition?.valueKind === "regex") rule.value = "";
    return rule;
  };

  const addRule = (type: RuleType | ""): void => {
    if (!type) return;
    setAddType("");
    commit([...rules, makeRule(type)]);
  };

  const changeType = (index: number, type: RuleType): void => {
    commit(rules.map((rule, i) => (i === index ? makeRule(type) : rule)));
  };

  /** 单条规则可切换的类型：required 只有它自己，其余按组件类型过滤 */
  const typeOptions = (rule: ValidationRule): Array<{ label: string; value: string }> => {
    const types: RuleType[] = rule.type === "required" ? ["required"] : ruleTypesFor(component);
    return types.map((type) => ({
      value: type,
      label: getRuleDefinition(type)?.label ?? type,
    }));
  };

  const patch = (index: number, partial: Partial<ValidationRule>): void => {
    commit(rules.map((rule, i) => (i === index ? { ...rule, ...partial } : rule)));
  };

  const setNumber = (index: number, raw: unknown): void => {
    const value = Number(raw);
    patch(index, { value: Number.isFinite(value) ? value : 0 });
  };

  const setText = (index: number, raw: unknown): void => {
    const value = String(raw ?? "");
    patch(index, value === "" ? { value: undefined } : { value });
  };

  const setFlags = (index: number, raw: unknown): void => {
    const value = String(raw ?? "").replace(/[^imsu]/g, "");
    patch(index, value ? { flags: value } : { flags: undefined });
  };

  const remove = (index: number): void => {
    commit(rules.filter((_rule, i) => i !== index));
  };

  const isInvalidRegex = (rule: ValidationRule): boolean => {
    if (rule.type !== "pattern" || !rule.value) return false;
    return compilePattern(String(rule.value), rule.flags ?? "") === null;
  };

  const preview = (rule: ValidationRule): string =>
    ruleMessage(rule, label || "该项", component);

  return (
    <div className="rules">
      <div className="rules__head">
        <div>
          <div className="rules__title">校验规则</div>
          <div className="rules__sub">
            {label || "该字段"} · {rules.length} 条
          </div>
        </div>
        <UiControl
          as="Switch"
          size="small"
          value={required}
          onChange={(value: unknown) => toggleRequired(Boolean(value))}
        />
      </div>

      <div className="rules__hint">
        规则随 Schema 保存，运行时会自动执行；必填、长度、数值范围、正则都在这一处配置。
      </div>

      {!rules.length ? <div className="rules__empty">还没有规则，从下方添加一条</div> : null}

      {rules.map((rule, index) => {
        const definition = getRuleDefinition(rule.type);
        const kind = definition?.valueKind;
        return (
          <div className="rule" key={`${rule.type}-${index}`}>
            <div className="rule__top">
              <UiControl
                as="Select"
                className="rule__type"
                size="small"
                value={rule.type}
                options={typeOptions(rule)}
                disabled={rule.type === "required"}
                onChange={(value: unknown) => changeType(index, String(value) as RuleType)}
              />
              <button
                type="button"
                className="rule__del"
                title="删除该规则"
                onClick={() => remove(index)}
              >
                ×
              </button>
            </div>

            {kind === "number" || kind === "length" ? (
              <div className="rule__value">
                <span className="rule__value-label">{definition?.valueLabel}</span>
                <UiControl
                  as="NumberInput"
                  size="small"
                  value={Number(rule.value ?? 0)}
                  min={0}
                  controls={false}
                  onChange={(value: unknown) => setNumber(index, value)}
                />
              </div>
            ) : null}

            {kind === "regex" ? (
              <div className="rule__regex">
                <UiControl
                  as="Input"
                  className="rule__regex-input"
                  size="small"
                  value={String(rule.value ?? "")}
                  placeholder="^\d{6}$"
                  onChange={(value: unknown) => setText(index, value)}
                />
                <UiControl
                  as="Input"
                  className="rule__flags"
                  size="small"
                  value={rule.flags ?? ""}
                  placeholder="imsu"
                  onChange={(value: unknown) => setFlags(index, value)}
                />
              </div>
            ) : null}

            {isInvalidRegex(rule) ? (
              <div className="rule__error">正则无法编译，请检查括号与转义</div>
            ) : null}

            <UiControl
              as="Input"
              className="rule__message"
              size="small"
              value={rule.message ?? ""}
              placeholder={`默认提示：${preview(rule)}`}
              onChange={(value: unknown) =>
                patch(
                  index,
                  String(value ?? "").trim()
                    ? { message: String(value) }
                    : { message: undefined },
                )
              }
            />

            <div className="rule__when">
              <UiControl
                as="Input"
                size="small"
                value={rule.when ?? ""}
                placeholder="生效条件（可选），如 {{form.type}} === 'company'"
                onChange={(value: unknown) =>
                  patch(
                    index,
                    String(value ?? "").trim() ? { when: String(value) } : { when: undefined },
                  )
                }
              />
            </div>

            <div className="rule__preview">{preview(rule)}</div>
          </div>
        );
      })}

      {availableTypes.length ? (
        <UiControl
          as="Select"
          className="rules__add"
          size="small"
          value={addType}
          options={availableTypes}
          placeholder="+ 添加规则"
          onChange={(value: unknown) => addRule(String(value) as RuleType)}
        />
      ) : null}

      <div className="rules__tip">
        空值只由「必填」拦截；其余规则在字段为空时跳过，避免同一个空格子报两条错。
      </div>
    </div>
  );
}
