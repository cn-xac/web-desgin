/**
 * 事件动作编辑器：Schema 里只存 { action, args }，不出现可执行代码。
 * 与 Vue 版 EventsEditor.vue 功能对齐，差异只在受控通道 value / onChange。
 */
import { useEffect, useState } from "react";
import { ACTION_OPTIONS } from "@x-ac/design-core";
import type { ActionSchema } from "@x-ac/design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

/** 切换动作时把参数重置为该动作的示例参数，避免把上个动作的参数带过来 */
const DEFAULT_ARGS: Record<string, Record<string, unknown>> = {
  toast: { text: "操作成功", type: "success" },
  submitForm: { from: "form", to: "list" },
  resetForm: { path: "form" },
  resetState: {},
  setState: { path: "form.name", value: "" },
  clearList: { path: "list" },
  confirm: { text: "确认执行该操作？" },
  navigate: { to: "/pages" },
};

const argsTextOf = (action: ActionSchema): string => JSON.stringify(action.args ?? {}, null, 2);

interface ActionRowProps {
  action: ActionSchema;
  onChangeAction: (action: string) => void;
  onRemove: () => void;
  onApplyArgs: (text: string) => void;
}

/**
 * 单个动作行：参数 JSON 用局部 state 暂存草稿，点击「应用」才解析校验并写入 store。
 *
 * 为什么不在 onChange（每次按键）里 JSON.parse：UiControl 的受控通道每次输入都触发，
 * 而正在输入的 JSON 几乎总是半成品，逐字符解析会不断报 error、且校验失败就不写回，
 * 会让草稿被拒绝、文本无法继续编辑。这里等价于 Vue 版 el-input 的 @change（失焦提交），
 * 但改用显式的「应用」按钮：UiControl 槽位没有 onBlur，这样最可靠、不依赖 DOM 细节。
 * store 侧 args 变化（切换动作 / 撤销）时，用 useEffect 把草稿同步回规范文本。
 */
function ActionRow({ action, onChangeAction, onRemove, onApplyArgs }: ActionRowProps) {
  const argsText = argsTextOf(action);
  const [text, setText] = useState(argsText);

  // 只在「规范文本」变化时同步：用户打字期间 store 不变，argsText 不变，不会覆盖草稿。
  useEffect(() => {
    setText(argsText);
  }, [argsText]);

  return (
    <div className="events__item">
      <div className="events__item-head">
        <UiControl
          as="Select"
          size="small"
          value={action.action}
          options={ACTION_OPTIONS}
          onChange={(value: unknown) => onChangeAction(String(value))}
        />
        <button type="button" className="events__del" title="删除" onClick={onRemove}>
          ×
        </button>
      </div>
      <UiControl
        as="Input"
        rows={3}
        size="small"
        value={text}
        placeholder="参数 JSON"
        onChange={(value: unknown) => setText(String(value ?? ""))}
      />
      <UiControl as="Button" size="small" onClick={() => onApplyArgs(text)}>
        应用参数
      </UiControl>
    </div>
  );
}

export function EventsEditor() {
  const { store, state, registry, notify } = useDesigner();

  const node = state.selectedNode;
  const material = node ? registry.get(node.component) : undefined;
  const events = material?.events ?? [];

  const actionsOf = (name: string): ActionSchema[] => node?.events?.[name] ?? [];

  /** 所有写入统一走 store.setEventActions */
  const write = (name: string, list: ActionSchema[]): void => store.setEventActions(name, list);

  const addAction = (name: string): void => {
    write(name, [...actionsOf(name), { action: "toast", args: { ...DEFAULT_ARGS.toast } }]);
  };

  const changeAction = (name: string, index: number, action: string): void => {
    const list = actionsOf(name).slice();
    list[index] = { action, args: { ...(DEFAULT_ARGS[action] ?? {}) } };
    write(name, list);
  };

  const removeAction = (name: string, index: number): void => {
    const list = actionsOf(name).slice();
    list.splice(index, 1);
    write(name, list);
  };

  /** 参数必须是非 null、非数组的 JSON 对象；失败只提示、不写入 */
  const changeArgs = (name: string, index: number, text: string): void => {
    let args: Record<string, unknown>;
    try {
      const parsed: unknown = text.trim() ? JSON.parse(text) : {};
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("args 必须是对象");
      }
      args = parsed as Record<string, unknown>;
    } catch (error) {
      notify(`参数不是合法 JSON：${(error as Error).message}`, "error");
      return;
    }
    const list = actionsOf(name).slice();
    list[index] = { ...list[index], args };
    write(name, list);
  };

  return (
    <div className="events">
      <div className="events__note">
        事件只存「动作名 + 参数」，Schema 里不出现可执行代码。动作由渲染器注册表实现，新增动作需要改代码。
      </div>

      {events.map((event) => {
        const actions = actionsOf(event.name);
        return (
          <section className="events__group" key={event.name}>
            <div className="events__head">
              <span className="events__name">{event.title}</span>
              <span className="events__code">{event.name}</span>
              <div className="spacer" />
              <UiControl
                as="Button"
                size="small"
                type="primary"
                onClick={() => addAction(event.name)}
              >
                + 动作
              </UiControl>
            </div>

            {!actions.length ? (
              <div className="events__empty">未配置动作，点击「+ 动作」添加</div>
            ) : null}

            {actions.map((action, index) => (
              <ActionRow
                key={index}
                action={action}
                onChangeAction={(next) => changeAction(event.name, index, next)}
                onRemove={() => removeAction(event.name, index)}
                onApplyArgs={(text) => changeArgs(event.name, index, text)}
              />
            ))}
          </section>
        );
      })}

      {!events.length ? <div className="events__empty">当前组件没有可配置事件</div> : null}
    </div>
  );
}
