/**
 * Moka 自研组件库（sd- 前缀，类名带 CSS Modules 哈希，所以只按前缀匹配）的下拉：
 *   label.sd-Input-container.sd-Select-container > input.sd-Input-input
 * 打开：在 input 上依次派发 pointerdown、mousedown、focus、mouseup、click（只 click 打不开）。
 * 浮层渲染在字段内部：sd-Dropdown-container > sd-Dropdown-dropdown > sd-Select-menu
 *   > sd-Menu-content-item（文字在 .option-label 里或直接是文本）。
 * 页面结构详见 docs/platforms/moka.md。
 */

import { safeClick, clickOutside, hover, isVisible, typeText, waitFor, waitForSettled } from "../dom-actions.js";
import { normalizeText, pickBestOption } from "../option-match.js";
import { createSelectControl } from "./select.js";
import { createDateRangeControl } from "./date-range.js";
import { createYearMonthControl } from "./year-month.js";
import { filled, needsConfirmation, skipped, failed, restored, unchanged } from "./results.js";

const DROPDOWN = '[class*="sd-Dropdown-dropdown"]';
const MENU_ITEM = '[class*="sd-Menu-content-item"]';

export function mokaFieldOf(el) {
  return el.closest('[class*="apply-field"]:not([class*="apply-fields"])');
}

export function inputContainerOf(input) {
  return input.closest('[class*="sd-Input-container"], [class*="sd-Select-container"]') ?? input.parentElement;
}

/**
 * 找这个输入框自己的浮层：从输入框往外一层层找，找到字段边界为止；同一个字段里
 * 有好几个下拉（年、月、年、月）时，离得最近的那个才是它的。万一浮层被挂到了
 * 字段外面，再退一步找页面上不属于任何字段的可见浮层。
 */
export function findMokaOverlay(input, selector = DROPDOWN) {
  const field = mokaFieldOf(input);
  for (let node = input.parentElement; node; node = node.parentElement) {
    const found = Array.from(node.querySelectorAll(selector)).find(isVisible);
    if (found) return found;
    if (node === field) break;
  }
  return Array.from(document.querySelectorAll(selector)).find((el) => isVisible(el) && !mokaFieldOf(el)) ?? null;
}

/** 只保留最外层（选项里还套着带同样前缀类名的子元素时不重复算）。 */
export function outermost(elements) {
  return elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
}

export function menuItems(dropdown) {
  return outermost(Array.from(dropdown?.querySelectorAll(MENU_ITEM) ?? []))
    .filter((el) => !/disabled/i.test(el.className))
    .map((el) => ({
      el,
      text: (el.querySelector('.option-label, [class*="option-label"]') ?? el).textContent.trim(),
    }));
}

/** 按实测的事件顺序按下输入框，等浮层出现。 */
export async function openMokaOverlay(input, selector = DROPDOWN) {
  const open = findMokaOverlay(input, selector);
  if (open) return open;
  await safeClick(input, { focus: true });
  return waitFor(() => findMokaOverlay(input, selector));
}

export async function closeMokaOverlay(input, selector = DROPDOWN) {
  if (!findMokaOverlay(input, selector)) return true;
  await clickOutside();
  return !!(await waitFor(() => !findMokaOverlay(input, selector), { timeout: 2000 }));
}

/** 鼠标移到输入框上，点出现的清空按钮（×）。 */
export async function clearMokaInput(input, { what = "输入框" } = {}) {
  if (!input.value) return unchanged();
  const box = inputContainerOf(input);
  hover(box);
  const clear = await waitFor(() => Array.from(box.querySelectorAll('[class*="clear"]')).find(isVisible), {
    timeout: 1000,
  });
  if (!clear) return failed(`这个${what}没有清空按钮，没法自动清空，请手动检查`);
  await safeClick(clear);
  await waitFor(() => !input.value, { timeout: 1000 });
  return input.value ? failed(`点了清空按钮但${what}里还有值`) : restored();
}

const readText = (input) => input.value.trim();

const isDisabled = (input) => input.disabled || /disabled/i.test(inputContainerOf(input)?.className ?? "");

/** "年"这种输入框可以打字过滤，普通下拉是只读的。 */
const isSearchable = (input) => !input.readOnly && !input.disabled;

function verify(input, pick, wantedText) {
  const now = readText(input);
  if (normalizeText(now) !== normalizeText(pick.text)) {
    return failed(`选了「${pick.text}」，但回读到的是「${now || "空"}」`);
  }
  if (pick.exact) return filled(pick.text);
  return needsConfirmation(pick.text, `简历里是「${wantedText}」，下拉里没有完全一样的，选了最接近的「${pick.text}」`);
}

async function choose(input, match, { wantedText, keywords = null }) {
  if (isDisabled(input)) return failed("下拉框是禁用状态");
  if (!(await openMokaOverlay(input))) return failed("点开下拉框后没有出现选项浮层");

  let pick = null;
  const look = async () => {
    const dropdown = findMokaOverlay(input);
    if (!dropdown) return;
    await waitForSettled(dropdown, { quietMs: 60, timeout: 1500 });
    pick = match(menuItems(findMokaOverlay(input)).map((i) => i.text));
  };
  if (keywords?.length) {
    for (const keyword of keywords) {
      typeText(input, keyword);
      if (!(await waitFor(() => findMokaOverlay(input), { timeout: 1000 })) && !(await openMokaOverlay(input))) continue;
      await look();
      if (pick) break;
    }
  } else {
    await look();
  }

  if (!pick) {
    if (keywords?.length) typeText(input, "");
    await closeMokaOverlay(input);
    return skipped(`下拉选项里找不到「${wantedText}」，没有填`);
  }
  const item = menuItems(findMokaOverlay(input)).find((i) => i.text === pick.text);
  if (!item) {
    await closeMokaOverlay(input);
    return failed(`找到了「${pick.text}」但没法点到它`);
  }
  await safeClick(item.el);
  if (!(await waitFor(() => !findMokaOverlay(input), { timeout: 2000 }))) await closeMokaOverlay(input);
  await waitFor(() => normalizeText(readText(input)) === normalizeText(pick.text), { timeout: 1000 });
  return verify(input, pick, wantedText);
}

async function restore(input, snapshot) {
  if (normalizeText(readText(input)) === normalizeText(snapshot.text)) return unchanged();
  if (!snapshot.text) {
    const result = await clearMokaInput(input, { what: "下拉框" });
    await closeMokaOverlay(input);
    return result;
  }
  const result = await choose(input, (texts) => pickBestOption(texts, [snapshot.text]), {
    wantedText: snapshot.text,
    keywords: isSearchable(input) ? [snapshot.text] : null,
  });
  return result.status === "filled" ? restored() : failed(result.reason);
}

/** @type {import('./select.js').SelectOps} */
export const mokaSelectOps = { choose, readText, restore, isDisabled, isSearchable };

export const mokaSelectControl = createSelectControl(mokaSelectOps);
export const mokaYearMonthControl = createYearMonthControl(mokaSelectOps);
export const mokaDateRangeControl = createDateRangeControl(mokaSelectOps);
