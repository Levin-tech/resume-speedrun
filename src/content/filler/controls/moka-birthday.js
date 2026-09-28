/**
 * Moka 的 day_info（出生日期）：只读输入框，打开后是 sd-panal-menu-wrapper 面板
 * （Moka 自己就拼成 panal）：顶部年份选择 sd-basic-selector-year（如"1990年"，
 * 点开是年份列表），下面是月份 sd-basic-year-item（一月…十二月），点月份后再点日。
 */

import { safeClick, clickOutside, waitFor, waitForSettled } from "../dom-actions.js";
import { firstNumber, parseDateParts } from "../option-match.js";
import { findMokaOverlay, openMokaOverlay, closeMokaOverlay, clearMokaInput } from "./moka-select.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const PANEL = '[class*="sd-panal-menu-wrapper"], [class*="sd-panel-menu-wrapper"]';
const CN_MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const pad = (n) => String(n).padStart(2, "0");

const panelOf = (input) => findMokaOverlay(input, PANEL);

const ownText = (el) => el.textContent.trim();

/** 面板里没有子元素、文字正好是 text 的元素（年份选项、日期格子）。 */
function leavesWithText(panel, matches, exclude = null) {
  return Array.from(panel?.querySelectorAll("*") ?? []).filter(
    (el) =>
      el.children.length === 0 &&
      matches(ownText(el)) &&
      !/disabled|other|prev|next/i.test(el.className) &&
      !(exclude && (exclude === el || exclude.contains(el)))
  );
}

function yearSelector(panel) {
  return Array.from(panel?.querySelectorAll('[class*="sd-basic-selector-year"]') ?? []).find((el) =>
    /^\d{4}\s*年?$/.test(ownText(el))
  );
}

function monthMatches(text, month) {
  return text === CN_MONTHS[month - 1] || firstNumber(text) === month;
}

async function clickAndSettle(input, element) {
  await safeClick(element);
  const panel = panelOf(input);
  if (panel) await waitForSettled(panel, { quietMs: 60, timeout: 800 });
}

async function pickYear(input, year) {
  const shownYear = () => {
    const selector = yearSelector(panelOf(input));
    return selector ? firstNumber(ownText(selector)) : null;
  };
  const selector = yearSelector(panelOf(input));
  if (!selector) return "面板上没找到年份选择";
  if (shownYear() === year) return null;
  await clickAndSettle(input, selector);
  const isYear = (text) => text === `${year}年` || text === String(year);
  const option = await waitFor(() => leavesWithText(panelOf(input), isYear, yearSelector(panelOf(input)))[0]);
  if (!option) return `年份列表里没有 ${year} 年`;
  await clickAndSettle(input, option);
  const ok = await waitFor(() => shownYear() === year, { timeout: 1000 });
  return ok ? null : `点了 ${year} 年但面板上的年份没变`;
}

export async function fillMokaBirthday(input, date) {
  if (input.disabled) return failed("日期输入框是禁用状态");
  const target = { year: date.year, month: date.month || 1, day: date.day || 1 };
  const wanted = `${target.year}-${pad(target.month)}-${pad(target.day)}`;
  if (!(await openMokaOverlay(input, PANEL))) return failed("点开日期输入框后没有出现日期面板");

  const fail = async (reason) => {
    await closeMokaOverlay(input, PANEL);
    return failed(reason);
  };
  const yearProblem = await pickYear(input, target.year);
  if (yearProblem) return fail(yearProblem);

  const month = await waitFor(() =>
    Array.from(panelOf(input)?.querySelectorAll('[class*="sd-basic-year-item"]') ?? []).find((el) =>
      monthMatches(ownText(el), target.month)
    )
  );
  if (!month) return fail(`面板上没找到 ${target.month} 月`);
  await clickAndSettle(input, month);

  const day = await waitFor(() => leavesWithText(panelOf(input), (text) => text === String(target.day))[0]);
  if (!day) return fail(`面板上没找到 ${target.day} 号`);
  await safeClick(day);
  if (!(await waitFor(() => !panelOf(input), { timeout: 1500 }))) await clickOutside();

  const [y, m, d] = parseDateParts(input.value);
  if (y !== target.year || m !== target.month || d !== target.day) {
    return failed(`没能选中 ${wanted}，回读到的是「${input.value || "空"}」`);
  }
  return date.month && date.day ? filled(input.value) : needsConfirmation(input.value, "简历里没有具体到日，缺的部分按 1 月/1 号填了");
}

export const mokaBirthdayControl = {
  snapshot: (field) => ({ text: field.subElements.input.value }),

  fill: (field, value) => fillMokaBirthday(field.subElements.input, value),

  async restore(field, snapshot) {
    const input = field.subElements.input;
    if (input.value === snapshot.text) return unchanged();
    if (!snapshot.text) {
      const result = await clearMokaInput(input, { what: "日期输入框" });
      await closeMokaOverlay(input, PANEL);
      return result;
    }
    const [year, month, day] = parseDateParts(snapshot.text);
    const result = await fillMokaBirthday(input, { year, month: month ?? null, day: day ?? null });
    return result.status === "filled" ? restored() : failed(result.reason);
  },
};
