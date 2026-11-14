/**
 * 设计器自有控件的原生实现（零 UI 库依赖）。
 *
 * 设计器是「作者工具」，它的按钮、输入框、下拉不该绑死业务 UI 库：
 * 引擎必须能在没装任何 UI 库的环境里跑起来（测试、CLI、未来其它框架）。
 * 适配包若提供 designer kit，则整体替换这里的实现，保证「设计时与上线同观感」。
 */
import { defineComponent, h, type PropType } from "vue";

export interface SelectOption {
  label: string;
  value: string | number;
}

const sizeClass = (size?: string) => (size === "small" ? " wbd-sm" : "");

export const NativeButton = defineComponent({
  name: "WbdButton",
  inheritAttrs: false,
  props: {
    type: { type: String as PropType<"default" | "primary" | "danger" | "text">, default: "default" },
    size: { type: String, default: "small" },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        "button",
        {
          ...attrs,
          type: "button",
          disabled: props.disabled,
          class: ["wbd-btn", `wbd-btn--${props.type}`, props.size === "small" ? "wbd-sm" : "", (attrs.class as string) ?? ""],
        },
        slots.default?.(),
      );
  },
});

export const NativeInput = defineComponent({
  name: "WbdInput",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    type: { type: String, default: "text" },
    rows: { type: Number, default: 3 },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: "default" },
    maxlength: { type: Number, default: undefined },
  },
  emits: ["update:modelValue", "change", "enter"],
  setup(props, { emit, attrs }) {
    const onInput = (event: Event) => {
      emit("update:modelValue", (event.target as HTMLInputElement).value);
    };
    const onChange = (event: Event) => {
      emit("change", (event.target as HTMLInputElement).value);
    };
    return () =>
      props.type === "textarea"
        ? h("textarea", {
            ...attrs,
            class: ["wbd-input", "wbd-input--area", (attrs.class as string) ?? ""],
            value: props.modelValue,
            rows: props.rows,
            placeholder: props.placeholder,
            disabled: props.disabled,
            maxlength: props.maxlength,
            onInput,
            onChange,
          })
        : h("input", {
            ...attrs,
            class: ["wbd-input", sizeClass(props.size), (attrs.class as string) ?? ""],
            value: props.modelValue,
            placeholder: props.placeholder,
            disabled: props.disabled,
            maxlength: props.maxlength,
            onInput,
            onChange,
            onKeyup: (event: KeyboardEvent) => {
              if (event.key === "Enter") emit("enter");
            },
          });
  },
});

export const NativeNumber = defineComponent({
  name: "WbdNumber",
  inheritAttrs: false,
  props: {
    modelValue: { type: [Number, String], default: undefined },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: 1 },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: "default" },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    const onInput = (event: Event) => {
      const raw = (event.target as HTMLInputElement).value;
      emit("update:modelValue", raw === "" ? undefined : Number(raw));
    };
    return () =>
      h("input", {
        ...attrs,
        class: ["wbd-input", "wbd-number", sizeClass(props.size), (attrs.class as string) ?? ""],
        type: "number",
        value: props.modelValue,
        min: props.min,
        max: props.max,
        step: props.step,
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput,
        onChange: (event: Event) => emit("change", (event.target as HTMLInputElement).value),
      });
  },
});

export const NativeSelect = defineComponent({
  name: "WbdSelect",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    options: { type: Array as PropType<Array<SelectOption | string>>, default: () => [] },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: "default" },
    clearable: { type: Boolean, default: false },
    /** 搜索：原生 select 不支持，仅占位避免透传告警（宿主用 el-select 时生效，#3） */
    filterable: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    const normalize = (option: SelectOption | string, index: number): SelectOption =>
      typeof option === "string" ? { label: option, value: option } : option ?? { label: String(index), value: index };

    return () =>
      h(
        "select",
        {
          ...attrs,
          class: ["wbd-input", "wbd-select", sizeClass(props.size), (attrs.class as string) ?? ""],
          value: props.modelValue,
          disabled: props.disabled,
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            emit("update:modelValue", value);
            emit("change", value);
          },
        },
        [
          props.placeholder ? h("option", { value: "", disabled: true }, props.placeholder) : null,
          ...props.options.map((option, index) => {
            const item = normalize(option, index);
            return h("option", { value: item.value }, item.label);
          }),
        ],
      );
  },
});

export const NativeSwitch = defineComponent({
  name: "WbdSwitch",
  inheritAttrs: false,
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    return () =>
      h("button", {
        ...attrs,
        type: "button",
        role: "switch",
        "aria-checked": props.modelValue,
        disabled: props.disabled,
        class: ["wbd-switch", props.modelValue ? "is-on" : "", (attrs.class as string) ?? ""],
        onClick: () => {
          const next = !props.modelValue;
          emit("update:modelValue", next);
          emit("change", next);
        },
      });
  },
});

export const NativeSegmented = defineComponent({
  name: "WbdSegmented",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    options: { type: Array as PropType<SelectOption[]>, default: () => [] },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    return () =>
      h(
        "div",
        { ...attrs, class: ["wbd-seg", (attrs.class as string) ?? ""] },
        props.options.map((option) =>
          h(
            "button",
            {
              key: String(option.value),
              type: "button",
              class: ["wbd-seg__item", props.modelValue === option.value ? "is-on" : ""],
              onClick: () => {
                emit("update:modelValue", option.value);
                emit("change", option.value);
              },
            },
            option.label,
          ),
        ),
      );
  },
});

export const NativeColor = defineComponent({
  name: "WbdColor",
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit, attrs }) {
    return () => {
      // size 是 UI 库的尺寸约定，原生 input[type=color] 没有这个属性，
      // 直接透传会让 Vue 尝试往 DOM 属性上写并抛 DOMException（控制台刷屏）。
      const passthrough = { ...attrs };
      delete passthrough.size;

      return h("input", {
        ...passthrough,
        class: ["wbd-color", (attrs.class as string) ?? ""],
        type: "color",
        value: props.modelValue || "#ffffff",
        disabled: props.disabled,
        onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value),
        onChange: (event: Event) => emit("change", (event.target as HTMLInputElement).value),
      });
    };
  },
});
