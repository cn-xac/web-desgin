import { useState, type DragEvent } from "react";
import { materialKey } from "@x-ac/web-design-core";
import { useDesigner } from "../context";
import { UiControl } from "../ui";

/** 物料面板：搜索、分组、点击或拖拽添加；当前 UI 库未实现的物料置灰禁用 */
export function PalettePanel() {
  const { store, adapter, registry } = useDesigner();
  const [keyword, setKeyword] = useState("");

  const components = adapter?.components;
  const unavailable = (component: string): boolean => {
    if (!components) return false;
    return !(materialKey(component) in components) && !(component in components);
  };

  const key = keyword.trim().toLowerCase();
  const groups = registry
    .byCategory()
    .map((group) => ({
      category: group.category,
      items: key
        ? group.items.filter(
            (item) =>
              item.title.toLowerCase().includes(key) || item.component.toLowerCase().includes(key),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const unavailableCount = groups.reduce(
    (sum, group) => sum + group.items.filter((item) => unavailable(item.component)).length,
    0,
  );

  const onAdd = (component: string): void => {
    if (!unavailable(component)) store.addNodeSmart(component);
  };

  const onDragStart = (event: DragEvent<HTMLElement>, component: string): void => {
    if (unavailable(component)) {
      event.preventDefault();
      return;
    }
    const payload = { kind: "new" as const, component };
    store.beginDrag(payload);
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="palette">
      <div className="palette__search">
        <UiControl
          as="Input"
          value={keyword}
          onChange={(value: unknown) => setKeyword(String(value))}
          size="small"
          placeholder="搜索组件"
          clearable
        />
      </div>

      <div className="palette__scroll wb-scroll">
        {groups.map((group) => (
          <section key={group.category} className="palette__group">
            <div className="palette__title">{group.category}</div>
            {group.items.map((item) => {
              const disabled = unavailable(item.component);
              return (
                <div
                  key={item.component}
                  className={`palette__item${disabled ? " is-disabled" : ""}`}
                  draggable={!disabled}
                  title={
                    disabled
                      ? `${item.title}：当前 UI 库未提供该物料，换适配包后再用`
                      : item.hint ?? item.title
                  }
                  onDragStart={(event) => onDragStart(event, item.component)}
                  onDragEnd={() => store.clearDrag()}
                  onClick={() => onAdd(item.component)}
                >
                  <span className="palette__icon">{item.icon}</span>
                  <span className="palette__name">{item.title}</span>
                  {item.owner === "user" ? (
                    <span className="palette__own" title="业务物料：宿主注册，跨库可移植性由注册者负责">
                      自
                    </span>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}
        {groups.length === 0 ? <div className="palette__empty">没有匹配的组件</div> : null}
      </div>

      <div className="palette__foot">
        拖入画布，或点击添加到选中容器
        <br />
        可用 {total - unavailableCount} / 共 {total}
        {unavailableCount > 0 ? (
          <>
            <br />
            灰色物料当前 UI 库未实现，换适配包后可用（{unavailableCount} 个）
          </>
        ) : null}
      </div>
    </aside>
  );
}
