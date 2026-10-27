/**
 * Moka 的 day_info（出生日期）：只读输入框，打开后是 sd-panal-menu-wrapper 面板
 * （Moka 自己就拼成 panal）：顶部年份选择 sd-basic-selector-year（如"1990年"，
 * 点开是年份列表），下面是月份 sd-basic-year-item（一月…十二月），点月份后再点日。
 * 年份列表默认停在 1990 年附近那一页，目标年份不在这一页时要翻页（或滚动）找。
 */

import { safeClick, clickOutside, readShownText, waitFor, waitForSettled } from "../dom-actions.js";
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

const YEAR_TEXT = /^(\d{4})\s*年?$/;
const MAX_PAGES = 30;

/** 面板里现在能看到的年份选项（不含顶部显示当前年份的那个）。 */
function visibleYears(panel) {
  return leavesWithText(panel, (text) => YEAR_TEXT.test(text), yearSelector(panel)).map((el) => ({
    el,
    year: firstNumber(ownText(el)),
  }));
}

/** 往前/往后翻一页的箭头：类名带 prev/next/left/right，或文字是 ‹ › « » < >。 */
function pageArrow(panel, forward) {
  const words = forward ? /next|right|forward/i : /prev|left|back/i;
  const glyphs = forward ? /^[›»>→]+$/ : /^[‹«<←]+$/;
  return Array.from(panel?.querySelectorAll("*") ?? []).find(
    (el) =>
      !/disabled/i.test(el.className) &&
      el.children.length === 0 &&
      (glyphs.test(ownText(el)) || (words.test(el.className) && !YEAR_TEXT.test(ownText(el))))
  );
}

function scrollBoxOf(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 2) return node;
    if (/menu-wrapper/.test(node.className)) break;
  }
  return null;
}

/** 目标年份不在可见范围时翻页（没有翻页箭头就滚动年份列表），最多翻 MAX_PAGES 次。 */
async function revealYear(input, year) {
  for (let page = 0; page <= MAX_PAGES; page += 1) {
    const years = visibleYears(panelOf(input));
    const hit = years.find((y) => y.year === year);
    if (hit || years.length === 0) return hit?.el ?? null;
    const forward = year > Math.max(...years.map((y) => y.year));
    const before = years.map((y) => y.year).join(",");
    const arrow = pageArrow(panelOf(input), forward);
    if (arrow) {
      await clickAndSettle(input, arrow);
    } else {
      const box = scrollBoxOf(years[0].el);
      if (!box) return null;
      box.scrollTop += (forward ? 1 : -1) * Math.max(box.clientHeight - 20, 20);
      box.dispatchEvent(new Event("scroll"));
    }
    const moved = await waitFor(() => visibleYears(panelOf(input)).map((y) => y.year).join(",") !== before, {
      timeout: 800,
    });
    const scrolledInto = visibleYears(panelOf(input)).find((y) => y.year === year);
    if (scrolledInto) return scrolledInto.el;
    if (!moved) return null;
  }
  return null;
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
  if (!(await waitFor(() => visibleYears(panelOf(input)).length > 0, { timeout: 1500 }))) {
    return "点了年份但没有出现年份列表";
  }
  const option = await revealYear(input, year);
  if (!option) return `年份列表里翻页也没找到 ${year} 年`;
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

  await waitFor(() => readShownText(input), { timeout: 1000 });
  const now = readShownText(input);
  const [y, m, d] = parseDateParts(now);
  if (y !== target.year || m !== target.month || d !== target.day) {
    return failed(`没能选中 ${wanted}，回读到的是「${now || "空"}」`);
  }
  return date.month && date.day ? filled(now) : needsConfirmation(now, "简历里没有具体到日，缺的部分按 1 月/1 号填了");
}

export const mokaBirthdayControl = {
  snapshot: (field) => ({ text: readShownText(field.subElements.input) }),

  fill: (field, value) => fillMokaBirthday(field.subElements.input, value),

  async restore(field, snapshot) {
    const input = field.subElements.input;
    if (readShownText(input) === snapshot.text) return unchanged();
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
