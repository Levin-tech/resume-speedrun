/**
 * 日期选择器（Ant Design .ant-picker）：
 *   1. 优先直接在输入框里打日期再按回车（依次尝试几种常见格式）；
 *   2. 输入框只读或打字不被接受时，打开面板逐级点选 年 -> 月 -> 日。
 */

import {
  safeClick,
  clickOutside,
  pressKey,
  focusElement,
  setNativeValue,
  dispatchInput,
  hover,
  isVisible,
  waitFor,
  waitForSettled,
} from "../dom-actions.js";
import { parseDateParts } from "../option-match.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const PANEL_MODES = ["decade", "year", "quarter", "month", "week", "date"];
const pad = (n) => String(n).padStart(2, "0");

function inputOf(el) {
  return el.querySelector("input");
}

function findPanelDropdown() {
  const visible = Array.from(document.querySelectorAll(".ant-picker-dropdown")).filter(isVisible);
  return visible.at(-1) || null;
}

function panelMode(dropdown) {
  return PANEL_MODES.find((mode) => dropdown?.querySelector(`.ant-picker-${mode}-panel`)) || null;
}

function formatsFor(mode, { year, month, day }) {
  if (mode === "year") return [`${year}`];
  if (mode === "month") {
    return [`${year}-${pad(month)}`, `${year}/${pad(month)}`, `${year}.${pad(month)}`, `${year}年${pad(month)}月`];
  }
  return [
    `${year}-${pad(month)}-${pad(day)}`,
    `${year}/${pad(month)}/${pad(day)}`,
    `${year}.${pad(month)}.${pad(day)}`,
    `${year}年${pad(month)}月${pad(day)}日`,
  ];
}

function matchesTarget(text, target, mode) {
  const [y, m, d] = parseDateParts(text);
  if (y !== target.year) return false;
  if (mode === "year") return true;
  if (m !== target.month) return false;
  return mode === "month" || d === target.day;
}

async function openPanel(el) {
  const open = findPanelDropdown();
  if (open) return open;
  await safeClick(inputOf(el));
  return waitFor(findPanelDropdown);
}

async function closePanel() {
  if (!findPanelDropdown()) return;
  await clickOutside();
  await waitFor(() => !findPanelDropdown(), { timeout: 2000 });
}

async function tryTyping(el, target, mode) {
  const input = inputOf(el);
  for (const text of formatsFor(mode, target)) {
    if (!(await openPanel(el))) return false;
    if (input.readOnly) return false;
    focusElement(input);
    setNativeValue(input, text);
    dispatchInput(input, text);
    await waitForSettled(findPanelDropdown() || el, { quietMs: 60, timeout: 500 });
    await pressKey(input, "Enter");
    const closed = await waitFor(() => !findPanelDropdown(), { timeout: 800 });
    if (closed && matchesTarget(input.value, target, mode)) return true;
  }
  if (findPanelDropdown() && input.value) {
    setNativeValue(input, "");
    dispatchInput(input, "");
  }
  return false;
}

function findCell(dropdown, title) {
  return dropdown.querySelector(`.ant-picker-cell-in-view[title="${title}"]`);
}

async function clickAndSettle(element, dropdown) {
  await safeClick(element);
  await waitForSettled(dropdown, { quietMs: 60, timeout: 1000 });
}

/** 在面板里逐级点：日期面板 -> 点年份进年面板 -> 翻到目标年代 -> 点年 -> 点月 -> 点日。 */
async function clickThroughPanel(el, target, finalMode) {
  const titles = {
    year: `${target.year}`,
    month: `${target.year}-${pad(target.month)}`,
    date: `${target.year}-${pad(target.month)}-${pad(target.day)}`,
  };
  for (let step = 0; step < 40; step += 1) {
    const dropdown = findPanelDropdown();
    if (!dropdown) return true;
    const mode = panelMode(dropdown);
    const cell = titles[mode] ? findCell(dropdown, titles[mode]) : null;
    if (cell) {
      await clickAndSettle(cell, dropdown);
      if (mode === finalMode) return !!(await waitFor(() => !findPanelDropdown(), { timeout: 2000 }));
      continue;
    }
    if (mode === "date" || mode === "month") {
      const yearButton = dropdown.querySelector(".ant-picker-year-btn");
      if (!yearButton) return false;
      await clickAndSettle(yearButton, dropdown);
      continue;
    }
    if (mode === "year") {
      const [from, to] = parseDateParts(dropdown.querySelector(".ant-picker-decade-btn")?.textContent);
      const direction = target.year < from ? "prev" : target.year > to ? "next" : null;
      const button = direction && dropdown.querySelector(`.ant-picker-header-super-${direction}-btn`);
      if (!button) return false;
      await clickAndSettle(button, dropdown);
      continue;
    }
    return false;
  }
  return false;
}

export async function fillDatePicker(el, date) {
  const input = inputOf(el);
  if (!input) return failed("没找到日期输入框");
  if (el.classList.contains("ant-picker-disabled") || input.disabled) return failed("日期选择器是禁用状态");

  const dropdown = await openPanel(el);
  if (!dropdown) return failed("点开日期选择器后没有出现日期面板");
  const mode = panelMode(dropdown);
  const target = { year: date.year, month: date.month || 1, day: date.day || 1 };
  const guessed =
    (mode !== "year" && !date.month) || (mode === "date" && !date.day)
      ? "简历里没有具体到这一级，缺的部分按 1 月/1 号填了"
      : "";

  let ok = await tryTyping(el, target, mode);
  if (!ok) {
    await openPanel(el);
    ok = await clickThroughPanel(el, target, mode);
  }
  await closePanel();

  if (!ok || !matchesTarget(input.value, target, mode)) {
    return failed(`没能选中 ${formatsFor(mode, target)[0]}，回读到的是「${input.value || "空"}」`);
  }
  return guessed ? needsConfirmation(input.value, guessed) : filled(input.value);
}

async function clearDatePicker(el) {
  const clear = el.querySelector(".ant-picker-clear");
  if (!clear) return failed("日期选择器没有清空按钮，没法自动清空，请手动检查");
  hover(el);
  await safeClick(clear);
  await waitFor(() => !inputOf(el).value, { timeout: 1000 });
  await closePanel();
  return inputOf(el).value ? failed("点了清空按钮但日期还在") : restored();
}

export const dateControl = {
  snapshot: (field) => ({ text: inputOf(field.element)?.value ?? "" }),

  fill: (field, value) => fillDatePicker(field.element, value),

  async restore(field, snapshot) {
    const el = field.element;
    if (inputOf(el).value === snapshot.text) return unchanged();
    if (!snapshot.text) return clearDatePicker(el);
    const [year, month, day] = parseDateParts(snapshot.text);
    const result = await fillDatePicker(el, { year, month: month ?? null, day: day ?? null });
    return result.status === "filled" ? restored() : failed(result.reason);
  },
};
