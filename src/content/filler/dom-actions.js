/**
 * 填写引擎的底层动作：模拟鼠标/键盘、等待浮层出现或消失、点击安全检查。
 * 所有控件填写函数都只通过这里操作页面。
 */

/** 永远不允许 filler 自动点击的按钮文案关键词（避免误触发提交/删除）。 */
export const SUBMIT_LIKE_BLACKLIST = [
  "提交",
  "保存",
  "下一步",
  "确认",
  "确定",
  "投递",
  "申请",
  "完成",
  "发送",
  "删除",
  "移除",
  "确定投递",
];

export const DEFAULT_TIMEOUT = 3000;

const BUTTON_LIKE =
  'button, [role="button"], input[type="submit"], input[type="button"], input[type="image"], a[href]';

/** 不是 button 的元素（如 Moka 的"删除本条"是个 span）文字里带这些词也不点。 */
const DANGER_WORDS = ["提交", "删除", "移除", "投递"];
const SHORT_TEXT = 12;

function dangerWordNear(element) {
  let node = element;
  for (let depth = 0; node && node !== node.ownerDocument?.body && depth < 4; depth += 1) {
    const text = (node.textContent || "").trim();
    if (text.length > SHORT_TEXT) break;
    const word = DANGER_WORDS.find((w) => text.includes(w));
    if (word) return { text, word };
    node = node.parentElement;
  }
  return null;
}

/**
 * 判断点击某个元素是否可能触发"提交/保存/删除"类操作。返回拒绝原因，
 * 允许点击时返回 null。
 * @param {Element} element
 * @returns {string|null}
 */
export function getClickBlockReason(element) {
  const button = element.closest(BUTTON_LIKE);
  if (!button) {
    const hit = dangerWordNear(element);
    return hit ? `「${hit.text}」含有「${hit.word}」，插件不会点击` : null;
  }
  const text = (
    button.textContent ||
    button.value ||
    button.getAttribute("aria-label") ||
    button.getAttribute("title") ||
    ""
  ).trim();
  const word = SUBMIT_LIKE_BLACKLIST.find((w) => text.includes(w));
  if (word) return `按钮「${text}」含有「${word}」，插件不会点击`;
  // 表单里没写 type 的 <button> 默认就是提交按钮，点了等于提交。
  const isSubmitButton =
    (button.tagName === "BUTTON" && button.type === "submit" && button.form) ||
    (button.tagName === "INPUT" && (button.type === "submit" || button.type === "image"));
  if (isSubmitButton) return `按钮「${text}」会提交表单，插件不会点击`;
  return null;
}

export class ClickBlockedError extends Error {}

/** 让出一次事件循环，给页面框架（Vue/React）处理刚才事件的机会。 */
export function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function isVisible(element) {
  if (!element || !element.isConnected) return false;
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ visibilityProperty: true, opacityProperty: false });
  }
  return element.getClientRects().length > 0;
}

/**
 * 等到 predicate() 返回真值（用 MutationObserver 监听页面变化，不写死 sleep）。
 * 超时返回 null，由调用方决定怎么处理。
 * @template T
 * @param {() => T} predicate
 * @param {{ timeout?: number, root?: Node }} [options]
 * @returns {Promise<T|null>}
 */
export function waitFor(predicate, { timeout = DEFAULT_TIMEOUT, root } = {}) {
  return new Promise((resolve) => {
    let observer = null;
    let timer = null;
    let deadline = null;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
      clearTimeout(deadline);
      resolve(value);
    };
    const check = () => {
      let value;
      try {
        value = predicate();
      } catch {
        value = null;
      }
      if (value) finish(value);
    };
    check();
    if (done) return;
    observer = new MutationObserver(check);
    observer.observe(root || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    // 动画结束只改 computed style、不一定改 DOM，所以每隔一小段也复查一次。
    const poll = () => {
      if (done) return;
      check();
      if (!done) timer = setTimeout(poll, 50);
    };
    timer = setTimeout(poll, 50);
    deadline = setTimeout(() => finish(null), timeout);
  });
}

/**
 * 等某块 DOM 安静下来（quietMs 内没有任何变化），用于等搜索候选列表
 * 刷新完、虚拟列表滚动后重新渲染完。
 */
export function waitForSettled(root, { quietMs = 120, timeout = 2000 } = {}) {
  return new Promise((resolve) => {
    let quietTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
    const hardTimer = setTimeout(finish, timeout);
    function finish() {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(hardTimer);
      resolve();
    }
    observer.observe(root || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    quietTimer = setTimeout(finish, quietMs);
  });
}

function eventPoint(element) {
  const rect = element.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

function fireMouse(element, type, point) {
  const Ctor = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  return element.dispatchEvent(
    new Ctor(type, {
      bubbles: !["mouseenter", "mouseleave", "pointerenter", "pointerleave"].includes(type),
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: type.endsWith("down") ? 1 : 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      ...point,
    })
  );
}

export function hover(element) {
  const point = eventPoint(element);
  for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
    fireMouse(element, type, point);
  }
}

/**
 * 模拟一次真实的鼠标点击：移入 -> 按下 -> 抬起 -> click。
 * 点击前先过 getClickBlockReason 检查，命中黑名单直接抛错，绝不点击。
 * @param {Element} element
 * @param {{ focus?: boolean }} [options] focus：按下后一定让输入框获得焦点并派发
 *   focus 事件（Moka 的下拉要靠 mousedown + focus 才打开）
 */
export async function safeClick(element, { focus = false } = {}) {
  const blocked = getClickBlockReason(element);
  if (blocked) throw new ClickBlockedError(blocked);
  await dispatchClick(element, { focus });
}

// 不做黑名单检查的点击动作，只给 safeClick 和 clickDeleteOfAddedEntry 用，不导出。
async function dispatchClick(element, { focus = false } = {}) {
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  const point = eventPoint(element);
  hover(element);
  fireMouse(element, "pointerdown", point);
  const notPrevented = fireMouse(element, "mousedown", point);
  // 真实按下鼠标会让可聚焦元素获得焦点（组件主动阻止时除外）。
  const focusable = element.closest("input, textarea, select, [tabindex], [contenteditable='true']");
  if (focusable && focus) focusElement(focusable);
  else if (focusable && notPrevented && document.activeElement !== focusable) focusable.focus({ preventScroll: true });
  fireMouse(element, "pointerup", point);
  fireMouse(element, "mouseup", point);
  fireMouse(element, "click", point);
  await tick();
}

/**
 * 显示出来的值。有的组件库（如 Moka 的下拉、地区）选中后 input.value 一直是空的，
 * 选中的文字显示在同一个 label 里的 display-value 元素里，所以先看它，没有再看 value。
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 */
export function readShownText(input) {
  const box = input.closest('label, [class*="sd-Input-container"]');
  const display = box?.querySelector('[class*="display-value"]');
  const text = display?.textContent.trim() ?? "";
  if (text && !/placeholder/i.test(display.className) && text !== input.placeholder) return text;
  return (input.value ?? "").trim();
}

/** 鼠标移开（悬停才出现的清空按钮等会收起来）。 */
export function unhover(element) {
  const point = eventPoint(element);
  for (const type of ["pointerout", "pointerleave", "mouseout", "mouseleave"]) fireMouse(element, type, point);
}

// ---- 黑名单"删除"的唯一例外：删掉插件本次自己点"添加"加出来的那一段 ----

/** "删除本条"这类只删一段的按钮文字（去掉图标、空白后比较）。 */
export const DELETE_ENTRY_TEXT = /^删除(本条|此条|该条|这条|本段|此段)?$/;

const buttonWords = (el) => (el.textContent || el.value || "").replace(/[^\p{Script=Han}A-Za-z]/gu, "");

/**
 * 一段经历里所有输入项现在显示的值（按页面顺序）；勾选框记成"✓"或空。
 * @param {Element} entry
 * @returns {string[]}
 */
export function readEntryValues(entry) {
  return Array.from(entry.querySelectorAll("input, textarea, select"))
    .filter((el) => !["hidden", "file", "button", "submit", "image"].includes(el.type))
    .map((el) => {
      if (el.type === "checkbox" || el.type === "radio") return el.checked ? "✓" : "";
      if (el.tagName === "SELECT") return el.value;
      return readShownText(el);
    });
}

/**
 * 这一段里的每一项要么是空的，要么正好是插件填完时的值（pluginValues 是填完那一刻
 * 的 readEntryValues）。有任何一项是用户自己填/改的，就返回 false。
 */
export function hasOnlyPluginContent(entry, pluginValues = []) {
  const now = readEntryValues(entry);
  const sameShape = now.length === pluginValues.length;
  return now.every((value, i) => !value || (sameShape && value === pluginValues[i]));
}

/**
 * @typedef {Object} AddedEntryRecord 插件本次点"添加"加出来的一段
 * @property {Element} entry 这一段的容器
 * @property {string[]} [pluginValues] 插件填完时这一段的 readEntryValues
 */

/**
 * 能不能点这个"删除本条"。只有同时满足这几条才允许，返回拒绝原因或 null：
 * 这一段在本次添加记录里、还在页面上、按钮在这一段里面且文字就是"删除本条"、
 * 不是表单提交按钮、段里只有空值或插件填的值。
 * @param {Element} button
 * @param {Element} entry
 * @param {AddedEntryRecord[]} addedEntries 本次填写时插件添加的段
 * @returns {string|null}
 */
export function getDeleteEntryBlockReason(button, entry, addedEntries) {
  const record = (addedEntries ?? []).find((r) => r.entry === entry);
  if (!record) return "这一段不是插件本次添加的，插件不会删除";
  if (!entry.isConnected) return "这一段已经不在页面上了";
  if (!button || button === entry || !entry.contains(button)) return "删除按钮不在这一段里，插件不会点击";
  const words = buttonWords(button);
  if (!DELETE_ENTRY_TEXT.test(words)) return `按钮「${words}」不是“删除本条”，插件不会点击`;
  const asButton = button.closest("button, input");
  if (asButton && (asButton.type === "submit" || asButton.type === "image") && asButton.form) {
    return "这个按钮会提交表单，插件不会点击";
  }
  if (!hasOnlyPluginContent(entry, record.pluginValues)) {
    return "这一段里有不是插件填的内容，插件不会删除";
  }
  return null;
}

/**
 * 点插件本次添加的那一段里的"删除本条"。这是 SUBMIT_LIKE_BLACKLIST 里"删除"的唯一
 * 例外，只在撤销时用；每次点之前都用 getDeleteEntryBlockReason 重新检查一遍。
 */
export async function clickDeleteOfAddedEntry(button, entry, addedEntries) {
  const blocked = getDeleteEntryBlockReason(button, entry, addedEntries);
  if (blocked) throw new ClickBlockedError(blocked);
  await dispatchClick(button);
}

/** 在页面空白处按下鼠标，相当于"点一下别处"关闭浮层。 */
export async function clickOutside() {
  const target = document.body;
  const point = { clientX: 1, clientY: 1 };
  fireMouse(target, "pointerdown", point);
  fireMouse(target, "mousedown", point);
  fireMouse(target, "pointerup", point);
  fireMouse(target, "mouseup", point);
  fireMouse(target, "click", point);
  await tick();
}

const KEY_CODES = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ArrowDown: 40, ArrowUp: 38 };

export async function pressKey(element, key) {
  const init = {
    key,
    code: key,
    keyCode: KEY_CODES[key] ?? 0,
    which: KEY_CODES[key] ?? 0,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
  };
  element.dispatchEvent(new KeyboardEvent("keydown", init));
  element.dispatchEvent(new KeyboardEvent("keyup", init));
  await tick();
}

/** 获得焦点；页面不在前台时浏览器可能不派发 focus 事件，这时补发一次。 */
export function focusElement(element) {
  let fired = false;
  const listener = () => (fired = true);
  element.addEventListener("focus", listener, { once: true });
  element.focus({ preventScroll: true });
  element.removeEventListener("focus", listener);
  if (!fired) {
    element.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  }
}

export function blurElement(element) {
  let fired = false;
  const listener = () => (fired = true);
  element.addEventListener("blur", listener, { once: true });
  element.blur();
  element.removeEventListener("blur", listener);
  if (!fired) {
    element.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
    element.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }
}

/**
 * 用浏览器原生的 value setter 赋值（绕开 React/Vue 对 value 属性的拦截），
 * 再派发 input 事件，让组件库以为是用户输入的。
 */
export function setNativeValue(element, value) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
}

export function dispatchInput(element, data) {
  element.dispatchEvent(
    new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data })
  );
}

export function dispatchChange(element) {
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/** 获得焦点后把输入框内容换成 text，并派发 input 事件（相当于打字）。 */
export function typeText(input, text) {
  focusElement(input);
  setNativeValue(input, text);
  dispatchInput(input, text);
}
