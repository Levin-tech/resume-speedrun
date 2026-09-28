/**
 * Moka 自研组件库（sd- 前缀，类名带 CSS Modules 哈希，所以只按前缀匹配）的下拉：
 *   label.sd-Input-container.sd-Select-container > input.sd-Input-input
 * 打开：在 input 上依次派发 pointerdown、mousedown、focus、mouseup、click（只 click 打不开）。
 * 浮层渲染在字段内部：sd-Dropdown-container > sd-Dropdown-dropdown > sd-Select-menu
 *   > sd-Menu-content-item（文字在 .option-label 里或直接是文本）。
 * 选中后 input.value 保持为空，选中的文字在同一个 label 里的 sd-Input-display-value 里，
 * 回读一律用 readShownText。页面结构详见 docs/platforms/moka.md。
 */

import {
  safeClick,
  clickOutside,
  hover,
  unhover,
  isVisible,
  readShownText,
  tick,
  typeText,
  waitFor,
  waitForSettled,
} from "../dom-actions.js";
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

const CLEAR_ICON = '[class*="clear"], [class*="Clear"], [class*="close-circle"]';
const EMPTY_OPTION = /^(请选择|清空|清除|不选择)$/;

/** 下拉里有没有"请选择/清空"这种代表"不选"的选项，有就点它。 */
async function pickEmptyOption(input) {
  if (!(await openMokaOverlay(input))) return;
  const empty = menuItems(findMokaOverlay(input)).find((i) => EMPTY_OPTION.test(i.text));
  if (empty) await safeClick(empty.el);
  await closeMokaOverlay(input);
}

/**
 * 清空（撤销时把原来为空的项恢复成空）：先把鼠标移到输入框上点出现的清空按钮（×）；
 * 没有清空按钮的下拉再看有没有"请选择"这种空选项。都没有就只能请用户自己清空。
 * @param {{ what?: string, emptyOption?: boolean }} [options]
 */
export async function clearMokaInput(input, { what = "输入框", emptyOption = false } = {}) {
  if (!readShownText(input)) return unchanged();
  const box = inputContainerOf(input);
  hover(box);
  const clear = await waitFor(() => Array.from(box.querySelectorAll(CLEAR_ICON)).find(isVisible), {
    timeout: 800,
  });
  if (clear) {
    await safeClick(clear);
    await waitFor(() => !readShownText(input), { timeout: 1000 });
  }
  unhover(box);
  if (readShownText(input) && emptyOption && !input.disabled) await pickEmptyOption(input);
  if (!readShownText(input)) return restored();
  return failed(
    clear
      ? `点了清空按钮但${what}里还有值，该项需手动清空`
      : `这个${what}没有清空按钮，插件没法自动清空，该项需手动清空`
  );
}

const readText = readShownText;

const isDisabled = (input) => input.disabled || /disabled/i.test(inputContainerOf(input)?.className ?? "");

/** "年"这种输入框可以打字过滤、意向工作城市这种可以搜索，普通下拉是只读的。 */
const isSearchable = (input) => !input.readOnly && !input.disabled;

const SEARCH_TIMEOUT = 2500;
const isLoading = (dropdown) => !!dropdown.querySelector('[class*="loading"], [class*="Loading"], [class*="spin"]');

/**
 * 打字之后等候选出来：本地过滤的（年）马上就有，远程搜索的（城市）要等一会儿，
 * 等的时候可能先显示"搜索中"或"暂无数据"，所以一直等到有选项或超时。
 */
async function waitForResults(input) {
  await tick();
  return waitFor(
    () => {
      const dropdown = findMokaOverlay(input);
      return dropdown && !isLoading(dropdown) && menuItems(dropdown).length > 0 ? dropdown : null;
    },
    { timeout: SEARCH_TIMEOUT }
  );
}

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
      if (!(await waitForResults(input))) continue;
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
    const result = await clearMokaInput(input, { what: "下拉框", emptyOption: true });
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
