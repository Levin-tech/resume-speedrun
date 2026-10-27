// 仿 Moka 自研组件库（sd- 前缀）。按 2026-09 在 app.mokahr.com 实测的 DOM 结构复刻：
// 类名带 CSS Modules 式的随机哈希后缀（每次打开页面都不一样），下拉类控件
// 只响应 mousedown（只 click 打不开），浮层渲染在字段内部，点外面关闭。
// 下拉、地区选中后 input.value 保持为空，选中的文字显示在同一个 label 里的
// sd-Input-display-value 元素里（2026-09 真实页面上确认）。
// 真实页面的细节以 docs/platforms/moka.md 为准，这里只是尽量贴近的仿真。
import { defineComponent, h, ref, computed, onMounted, onBeforeUnmount } from "vue";

const HASH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const hashes = new Map();

function randomHash() {
  const length = 5 + Math.floor(Math.random() * 6);
  let text = "";
  for (let i = 0; i < length; i += 1) text += HASH_CHARS[Math.floor(Math.random() * HASH_CHARS.length)];
  // 真实的 CSS Modules 哈希基本都混有大写或数字，这里保证一定有，免得偶发撞上英文单词。
  return `${text.slice(0, -1)}${Math.floor(Math.random() * 10)}`;
}

/** 同一个基础类名在整个页面里用同一个哈希，就像 CSS Modules 打包出来的一样。 */
export function cx(base) {
  if (!hashes.has(base)) hashes.set(base, randomHash());
  return `${base}-${hashes.get(base)}`;
}

/** 点控件外面（mousedown）时关闭浮层。 */
function useOutsideClose(rootRef, isOpen, close) {
  const onDocumentDown = (event) => {
    if (isOpen() && rootRef.value && !rootRef.value.contains(event.target)) close();
  };
  onMounted(() => document.addEventListener("mousedown", onDocumentDown));
  onBeforeUnmount(() => document.removeEventListener("mousedown", onDocumentDown));
}

function clearIcon(onClear) {
  return h(
    "span",
    {
      class: cx("sd-Input-clear"),
      onMousedown: (event) => event.preventDefault(),
      onClick: (event) => {
        event.preventDefault();
        onClear();
      },
    },
    "×"
  );
}

/** 选中的文字：真实 Moka 不写进 input.value，而是显示在 input 旁边的这个元素里。 */
function displayValue(text) {
  return text ? h("span", { class: cx("sd-Input-display-value") }, text) : null;
}

function menu(items, onPick, selected, { loading = false, emptyText = "暂无数据" } = {}) {
  return h("div", { class: cx("sd-Dropdown-container") }, [
    h("div", { class: cx("sd-Dropdown-dropdown") }, [
      h(
        "div",
        { class: cx("sd-Select-menu") },
        loading
          ? [h("div", { class: cx("sd-Select-loading") }, "搜索中…")]
          : items.length
          ? items.map((item) =>
              h(
                "div",
                {
                  class: [cx("sd-Menu-content-item"), item.label === selected && cx("sd-Menu-content-item-selected")],
                  key: item.label,
                  onClick: () => onPick(item),
                },
                [h("span", { class: "option-label" }, item.label)]
              )
            )
          : [h("div", { class: cx("sd-Select-empty") }, emptyText)]
      ),
    ]),
  ]);
}

export const SdInput = defineComponent({
  props: { value: String, placeholder: { type: String, default: "请输入" } },
  emits: ["update:value"],
  setup(props, { emit }) {
    return () =>
      h("label", { class: cx("sd-Input-container") }, [
        h("input", {
          class: cx("sd-Input-input"),
          value: props.value,
          placeholder: props.placeholder,
          onInput: (event) => emit("update:value", event.target.value),
        }),
      ]);
  },
});

export const SdTextarea = defineComponent({
  props: { value: String },
  emits: ["update:value"],
  setup(props, { emit }) {
    return () =>
      h("label", { class: cx("sd-Textarea-container") }, [
        h("textarea", {
          class: cx("sd-Textarea-textarea"),
          rows: 3,
          value: props.value,
          placeholder: "请输入",
          onInput: (event) => emit("update:value", event.target.value),
        }),
      ]);
  },
});

/**
 * 下拉。filterable 的输入框可以打字过滤（Moka 的"年"就是这样）；remote 的是
 * 可搜索下拉（意向工作城市）：不输入不给选项，输入后隔一会儿才出联想结果。
 * 选中后 input.value 为空，选中的文字在 sd-Input-display-value 里。
 * clearable 的鼠标移到输入框上时出现清空按钮；不 clearable 的选中后就清不掉了。
 */
export const SdSelect = defineComponent({
  props: {
    value: [String, Number],
    options: Array,
    placeholder: { type: String, default: "请选择" },
    filterable: Boolean,
    remote: Boolean,
    clearable: { type: Boolean, default: true },
    disabled: Boolean,
    width: String,
  },
  emits: ["update:value"],
  setup(props, { emit }) {
    const root = ref(null);
    const open = ref(false);
    const hovering = ref(false);
    const query = ref("");
    const loading = ref(false);
    const remoteResults = ref([]);
    let timer = null;
    onBeforeUnmount(() => clearTimeout(timer));
    const searchable = computed(() => props.filterable || props.remote);
    const selected = computed(() => props.options.find((o) => o.value === props.value)?.label ?? "");
    const visibleOptions = computed(() => {
      if (props.remote) return remoteResults.value;
      return props.filterable && query.value ? props.options.filter((o) => o.label.includes(query.value)) : props.options;
    });
    const close = () => {
      open.value = false;
      query.value = "";
      loading.value = false;
      remoteResults.value = [];
      clearTimeout(timer);
    };
    useOutsideClose(root, () => open.value, close);

    const onMousedown = () => {
      if (props.disabled) return;
      if (open.value && !searchable.value) close();
      else open.value = true;
    };
    const onInput = (event) => {
      query.value = event.target.value;
      open.value = true;
      if (!props.remote) return;
      // 模拟向服务器要联想结果：先显示"搜索中"，隔一会儿才出结果。
      clearTimeout(timer);
      remoteResults.value = [];
      loading.value = !!query.value.trim();
      if (!loading.value) return;
      const text = query.value.trim();
      timer = setTimeout(() => {
        remoteResults.value = props.options.filter((o) => o.label.includes(text));
        loading.value = false;
      }, 250);
    };
    const pick = (option) => {
      emit("update:value", option.value);
      close();
    };
    const typing = computed(() => open.value && searchable.value && !!query.value);

    return () =>
      h("div", { class: cx("sd-Select-wrapper"), ref: root, style: props.width ? { width: props.width } : null }, [
        h(
          "label",
          {
            class: [cx("sd-Input-container"), cx("sd-Select-container"), props.disabled && cx("sd-Select-disabled")],
            onMouseenter: () => (hovering.value = true),
            onMouseleave: () => (hovering.value = false),
          },
          [
            h("input", {
              class: cx("sd-Input-input"),
              readonly: !searchable.value,
              disabled: props.disabled,
              value: typing.value ? query.value : "",
              placeholder: selected.value ? "" : props.placeholder,
              onMousedown,
              onInput,
            }),
            typing.value ? null : displayValue(selected.value),
            props.clearable && hovering.value && selected.value && !props.disabled
              ? clearIcon(() => emit("update:value", null))
              : h("span", { class: cx("sd-Select-arrow") }, "▾"),
          ]
        ),
        open.value
          ? menu(visibleOptions.value, pick, selected.value, {
              loading: loading.value,
              emptyText: props.remote && !query.value.trim() ? "请输入关键词搜索" : "暂无数据",
            })
          : null,
      ]);
  },
});

/** 学校/专业这类"输入后出联想候选"的输入框：候选要点选；没有候选时输入的文字照样保留。 */
export const SdSuggest = defineComponent({
  props: { value: String, candidates: Array },
  emits: ["update:value", "pick"],
  setup(props, { emit }) {
    const root = ref(null);
    const open = ref(false);
    const results = ref([]);
    let timer = null;
    useOutsideClose(root, () => open.value, () => (open.value = false));
    onBeforeUnmount(() => clearTimeout(timer));

    const onInput = (event) => {
      const text = event.target.value;
      emit("update:value", text);
      clearTimeout(timer);
      open.value = false;
      if (!text.trim()) return;
      // 模拟向服务器请求联想结果的延迟。
      timer = setTimeout(() => {
        results.value = props.candidates.filter((c) => c.includes(text.trim())).map((label) => ({ label }));
        open.value = results.value.length > 0;
      }, 150);
    };
    const pick = (item) => {
      emit("update:value", item.label);
      emit("pick", item.label);
      open.value = false;
    };

    return () =>
      h("div", { class: cx("sd-Dropdown-trigger"), ref: root }, [
        h("label", { class: cx("sd-Input-container") }, [
          h("input", {
            class: cx("sd-Input-input"),
            value: props.value,
            placeholder: "请输入",
            onInput,
          }),
        ]),
        open.value ? menu(results.value, pick, props.value) : null,
      ]);
  },
});

export const SdCheckbox = defineComponent({
  props: { checked: Boolean, label: String },
  emits: ["update:checked"],
  setup(props, { emit }) {
    return () =>
      h("label", { class: [cx("sd-Checkbox-container"), props.checked && cx("sd-Checkbox-checked")] }, [
        h("span", { class: cx("sd-Checkbox-checkbox") }, [
          h("input", {
            type: "checkbox",
            class: cx("sd-Checkbox-input"),
            checked: props.checked,
            onChange: (event) => emit("update:checked", event.target.checked),
          }),
        ]),
        h("span", { class: cx("sd-Checkbox-label") }, props.label),
      ]);
  },
});

/** 只读输入框 + 点开的面板，出生日期和籍贯共用这个外壳。 */
function panelShell({ root, open, hovering, value, placeholder, onToggle, onClear, useDisplayValue = false }, panel) {
  return h("div", { class: cx("sd-Picker-wrapper"), ref: root }, [
    h(
      "label",
      {
        class: cx("sd-Input-container"),
        onMouseenter: () => (hovering.value = true),
        onMouseleave: () => (hovering.value = false),
      },
      [
        h("input", {
          class: cx("sd-Input-input"),
          readonly: true,
          value: useDisplayValue ? "" : value,
          placeholder: useDisplayValue && value ? "" : placeholder,
          onMousedown: onToggle,
        }),
        useDisplayValue ? displayValue(value) : null,
        hovering.value && value ? clearIcon(onClear) : null,
      ]
    ),
    open.value ? panel() : null,
  ]);
}

const MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const pad = (n) => String(n).padStart(2, "0");

const YEAR_PAGE_SIZE = 12;

/**
 * 出生日期：顶部"‹ 1990年 ›"，点年份弹出年份列表。年份列表一页只有 12 年，
 * 默认停在 1990 年那一页，目标年份不在这一页时要点 ‹ › 翻页（真实页面实测如此）。
 * 不在年份列表时 ‹ › 是上一年/下一年。选好年份后点月份（一月…十二月），再点日。
 */
export const SdDayPicker = defineComponent({
  props: { value: String, minYear: Number, maxYear: Number },
  emits: ["update:value"],
  setup(props, { emit }) {
    const root = ref(null);
    const open = ref(false);
    const hovering = ref(false);
    const year = ref(1990);
    const month = ref(null);
    const yearListOpen = ref(false);
    const pageStart = ref(0);
    useOutsideClose(root, () => open.value, () => (open.value = false));

    const pageOf = (y) => props.minYear + Math.floor((y - props.minYear) / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE;
    const toggle = () => {
      if (!open.value) {
        year.value = props.value ? Number(props.value.slice(0, 4)) : 1990;
        month.value = null;
        yearListOpen.value = false;
      }
      open.value = !open.value;
    };
    const step = (direction) => {
      if (yearListOpen.value) {
        const next = pageStart.value + direction * YEAR_PAGE_SIZE;
        if (next + YEAR_PAGE_SIZE > props.minYear && next <= props.maxYear) pageStart.value = next;
      } else {
        year.value = Math.min(props.maxYear, Math.max(props.minYear, year.value + direction));
      }
    };

    const panel = () => {
      const header = h("div", { class: cx("sd-basic-selector") }, [
        h("span", { class: cx("sd-basic-arrow-prev"), onClick: () => step(-1) }, "‹"),
        h(
          "span",
          {
            class: cx("sd-basic-selector-year"),
            onClick: () => {
              yearListOpen.value = !yearListOpen.value;
              pageStart.value = pageOf(year.value);
            },
          },
          `${year.value}年`
        ),
        month.value ? h("span", { class: cx("sd-basic-selector-month") }, MONTH_NAMES[month.value - 1]) : null,
        h("span", { class: cx("sd-basic-arrow-next"), onClick: () => step(1) }, "›"),
      ]);
      let body;
      if (yearListOpen.value) {
        const years = [];
        for (let y = pageStart.value; y < pageStart.value + YEAR_PAGE_SIZE; y += 1) {
          if (y >= props.minYear && y <= props.maxYear) years.push(y);
        }
        body = h(
          "div",
          { class: cx("sd-basic-selector-year-list") },
          years.map((y) =>
            h(
              "div",
              {
                class: cx("sd-basic-selector-year-option"),
                key: y,
                onClick: () => {
                  year.value = y;
                  yearListOpen.value = false;
                },
              },
              `${y}年`
            )
          )
        );
      } else if (!month.value) {
        body = h(
          "div",
          { class: cx("sd-basic-year-panel") },
          MONTH_NAMES.map((name, i) =>
            h("div", { class: cx("sd-basic-year-item"), key: name, onClick: () => (month.value = i + 1) }, name)
          )
        );
      } else {
        const days = new Date(year.value, month.value, 0).getDate();
        body = h(
          "div",
          { class: cx("sd-basic-month-panel") },
          Array.from({ length: days }, (_, i) =>
            h(
              "div",
              {
                class: cx("sd-basic-day-item"),
                key: i,
                onClick: () => {
                  emit("update:value", `${year.value}-${pad(month.value)}-${pad(i + 1)}`);
                  open.value = false;
                },
              },
              String(i + 1)
            )
          )
        );
      }
      return h("div", { class: cx("sd-panal-menu-wrapper") }, [header, body]);
    };

    return () =>
      panelShell(
        {
          root,
          open,
          hovering,
          value: props.value,
          placeholder: "请选择日期",
          onToggle: toggle,
          onClear: () => emit("update:value", ""),
        },
        panel
      );
  },
});

const LEVEL_TABS = ["省份", "城市", "县区"];

/**
 * 地区（籍贯/所在地）：只读输入框，mousedown 打开 menu-wrapper 面板，有"热门地区"
 * 标签（sd-Tag）和"省份/城市/县区"三个页签，逐级点选；每选一级就写回。和下拉一样，
 * 选中的地区显示在 sd-Input-display-value 里，input.value 一直是空的。
 */
export const SdLocation = defineComponent({
  props: { value: Array, regions: Array, hot: Array },
  emits: ["update:value"],
  setup(props, { emit }) {
    const root = ref(null);
    const open = ref(false);
    const hovering = ref(false);
    const tab = ref(0);
    const path = ref([]);
    useOutsideClose(root, () => open.value, () => (open.value = false));

    const nodesAt = (level, currentPath) => {
      let nodes = props.regions;
      for (let i = 0; i < level; i += 1) {
        nodes = nodes.find((n) => n.name === currentPath[i])?.children ?? [];
      }
      return nodes;
    };
    const choose = (level, name) => {
      const next = [...path.value.slice(0, level), name];
      path.value = next;
      emit("update:value", next);
      if (nodesAt(level + 1, next).length) tab.value = level + 1;
      else open.value = false;
    };
    const chooseHot = (city) => {
      for (const province of props.regions) {
        const found = province.children.find((c) => c.name.startsWith(city));
        if (found) {
          path.value = [province.name, found.name];
          emit("update:value", path.value);
          tab.value = 2;
          return;
        }
      }
    };

    const panel = () =>
      h("div", { class: cx("menu-wrapper") }, [
        h("div", { class: cx("menu-hot") }, [
          h("span", { class: cx("menu-hot-title") }, "热门地区"),
          ...props.hot.map((city) =>
            h("span", { class: cx("sd-Tag-tag"), key: city, onClick: () => chooseHot(city) }, city)
          ),
        ]),
        h(
          "div",
          { class: cx("menu-tabs") },
          LEVEL_TABS.map((name, level) =>
            h(
              "div",
              {
                class: [cx("menu-tab"), level === tab.value && cx("menu-tab-active")],
                key: name,
                onClick: () => {
                  if (level <= path.value.length) tab.value = level;
                },
              },
              name
            )
          )
        ),
        h(
          "div",
          { class: cx("menu-content") },
          nodesAt(tab.value, path.value).map((node) =>
            h(
              "span",
              {
                class: [cx("menu-item"), path.value[tab.value] === node.name && cx("menu-item-active")],
                key: node.name,
                onClick: () => choose(tab.value, node.name),
              },
              node.name
            )
          )
        ),
      ]);

    const toggle = () => {
      if (!open.value) {
        path.value = [...(props.value ?? [])];
        tab.value = 0;
      }
      open.value = !open.value;
    };

    return () =>
      panelShell(
        {
          root,
          open,
          hovering,
          value: (props.value ?? []).join("/"),
          placeholder: "请选择",
          onToggle: toggle,
          onClear: () => emit("update:value", []),
          useDisplayValue: true,
        },
        panel
      );
  },
});

export const SdUpload = defineComponent({
  props: { text: String },
  setup(props) {
    return () =>
      h("div", { class: cx("sd-Upload-container") }, [
        h("span", { class: cx("sd-Upload-trigger") }, props.text || "点击上传"),
      ]);
  },
});
