/**
 * 组件库下拉 / 可搜索下拉（Ant Design 的 .ant-select，也兼容原生 <select>）。
 * 流程：点开触发器 -> 等浮层 -> （可搜索的先输入关键词、等候选刷新）
 *      -> 在浮层里找匹配选项（虚拟列表要边滚动边找）-> 点选 -> 等浮层关闭 -> 回读。
 */

import {
  safeClick,
  clickOutside,
  pressKey,
  focusElement,
  setNativeValue,
  dispatchInput,
  dispatchChange,
  hover,
  isVisible,
  waitFor,
  waitForSettled,
} from "../dom-actions.js";
import { buildCandidates, normalizeText, pickBestOption, searchKeywords } from "../option-match.js";
import { fieldNameOf, valueToText } from "../values.js";
import { filled, needsConfirmation, skipped, failed, restored, unchanged } from "./results.js";

const OPTION_SELECTOR = ".ant-select-item-option";

function isNativeSelect(el) {
  return el.tagName === "SELECT";
}

export function isSelectDisabled(el) {
  return isNativeSelect(el) ? el.disabled : el.classList.contains("ant-select-disabled");
}

export function readSelectText(el) {
  if (isNativeSelect(el)) {
    const option = el.selectedOptions[0];
    return option && option.value !== "" ? option.textContent.trim() : "";
  }
  const item = el.querySelector(".ant-select-selection-item");
  return item ? (item.getAttribute("title") || item.textContent).trim() : "";
}

function searchInput(el) {
  return el.querySelector("input");
}

/** 找到这个下拉自己的浮层：组件用 aria-owns 指向浮层里的列表 id。 */
function findDropdown(el) {
  const input = searchInput(el);
  const listId = input?.getAttribute("aria-owns") || input?.getAttribute("aria-controls");
  const list = listId ? document.getElementById(listId) : null;
  const dropdown = list?.closest(".ant-select-dropdown");
  if (dropdown) return isVisible(dropdown) ? dropdown : null;
  const visible = Array.from(document.querySelectorAll(".ant-select-dropdown")).filter(isVisible);
  return visible.at(-1) || null;
}

async function openDropdown(el) {
  const open = findDropdown(el);
  if (open) return open;
  await safeClick(el.querySelector(".ant-select-selector") || el);
  return waitFor(() => findDropdown(el));
}

async function closeDropdown(el) {
  if (!findDropdown(el)) return true;
  const input = searchInput(el);
  if (input) await pressKey(input, "Escape");
  if (await waitFor(() => !findDropdown(el), { timeout: 1000 })) return true;
  await clickOutside();
  return !!(await waitFor(() => !findDropdown(el), { timeout: 2000 }));
}

function optionText(option) {
  return (
    option.getAttribute("title") ||
    option.querySelector(".ant-select-item-option-content")?.textContent ||
    option.textContent
  ).trim();
}

function renderedOptions(dropdown) {
  return Array.from(dropdown.querySelectorAll(OPTION_SELECTOR))
    .filter((o) => !o.classList.contains("ant-select-item-option-disabled"))
    .map((el) => ({ el, text: optionText(el) }));
}

/** 虚拟列表只渲染看得见的几项，要像人一样往下滚才能看到后面的选项。 */
async function scrollList(dropdown, { toTop = false } = {}) {
  const holder = dropdown.querySelector(".rc-virtual-list-holder");
  if (!holder) return false;
  const before = holder.scrollTop;
  holder.scrollTop = toTop ? 0 : before + Math.max(holder.clientHeight - 32, 32);
  if (holder.scrollTop === before) return false;
  await waitForSettled(dropdown, { quietMs: 60, timeout: 1000 });
  return true;
}

/**
 * 滚动浏览整个选项列表，一边收集选项文案一边用 match 判断；
 * 一旦有完全匹配就提前停下。返回最终挑中的选项。
 */
async function browseOptions(dropdown, match) {
  const texts = [];
  const seen = new Set();
  let pick = null;
  const collect = () => {
    for (const { text } of renderedOptions(dropdown)) {
      if (!seen.has(text)) {
        seen.add(text);
        texts.push(text);
      }
    }
    pick = match(texts);
    return pick?.exact;
  };
  await scrollList(dropdown, { toTop: true });
  if (collect()) return pick;
  for (let page = 0; page < 200 && (await scrollList(dropdown)); page += 1) {
    if (collect()) return pick;
  }
  return pick;
}

async function locateOption(dropdown, text) {
  const find = () => renderedOptions(dropdown).find((o) => o.text === text)?.el;
  let found = find();
  if (found) return found;
  await scrollList(dropdown, { toTop: true });
  found = find();
  for (let page = 0; !found && page < 200 && (await scrollList(dropdown)); page += 1) {
    found = find();
  }
  return found || null;
}

/** 可搜索下拉：输入关键词后等候选列表刷新（有选项或显示"无数据"）。 */
async function typeSearch(el, keyword) {
  const input = searchInput(el);
  focusElement(input);
  setNativeValue(input, keyword);
  dispatchInput(input, keyword);
  await waitFor(() => {
    const dropdown = findDropdown(el);
    if (!dropdown) return true;
    return dropdown.querySelector(`${OPTION_SELECTOR}, .ant-select-item-empty, .ant-empty`);
  });
  const dropdown = findDropdown(el);
  if (dropdown) await waitForSettled(dropdown, { quietMs: 150, timeout: 3000 });
  return findDropdown(el);
}

async function clearSearchText(el) {
  const input = searchInput(el);
  if (input && input.value) {
    setNativeValue(input, "");
    dispatchInput(input, "");
  }
}

function chooseFromNativeSelect(el, match, wantedText) {
  const options = Array.from(el.options).filter((o) => !o.disabled && o.value !== "");
  const pick = match(options.map((o) => o.textContent.trim()));
  if (!pick) return skipped(`下拉选项里找不到「${wantedText}」`);
  focusElement(el);
  setNativeValue(el, options[pick.index].value);
  dispatchInput(el);
  dispatchChange(el);
  return verify(el, pick, wantedText);
}

function verify(el, pick, wantedText) {
  const now = readSelectText(el);
  if (normalizeText(now) !== normalizeText(pick.text)) {
    return failed(`选了「${pick.text}」，但回读到的是「${now || "空"}」`);
  }
  if (pick.exact) return filled(pick.text);
  return needsConfirmation(
    pick.text,
    `简历里是「${wantedText}」，下拉里没有完全一样的，选了最接近的「${pick.text}」`
  );
}

/**
 * 在下拉里选中 match 挑出的那一项。
 * @param {HTMLElement} el .ant-select 根节点或原生 <select>
 * @param {(texts: string[]) => import('../option-match.js').OptionPick|null} match
 * @param {{ wantedText: string, keywords?: string[]|null }} options
 */
export async function chooseFromSelect(el, match, { wantedText, keywords = null }) {
  if (isSelectDisabled(el)) return failed("下拉框是禁用状态");
  if (isNativeSelect(el)) return chooseFromNativeSelect(el, match, wantedText);

  let dropdown = await openDropdown(el);
  if (!dropdown) return failed("点开下拉框后没有出现选项浮层");

  let pick = null;
  if (keywords?.length) {
    for (const keyword of keywords) {
      dropdown = await typeSearch(el, keyword);
      if (!dropdown) dropdown = await openDropdown(el);
      if (!dropdown) continue;
      pick = await browseOptions(dropdown, match);
      if (pick) break;
    }
  } else {
    pick = await browseOptions(dropdown, match);
  }

  if (!pick || !dropdown) {
    await clearSearchText(el);
    await closeDropdown(el);
    return skipped(`下拉选项里找不到「${wantedText}」，没有填`);
  }

  const optionEl = await locateOption(dropdown, pick.text);
  if (!optionEl) {
    await closeDropdown(el);
    return failed(`找到了「${pick.text}」但没法点到它`);
  }
  await safeClick(optionEl);
  if (!(await waitFor(() => !findDropdown(el), { timeout: 2000 }))) await closeDropdown(el);
  await waitFor(() => normalizeText(readSelectText(el)) === normalizeText(pick.text), { timeout: 1000 });
  return verify(el, pick, wantedText);
}

/** 清空下拉（点组件自带的 × 清除按钮）。 */
export async function clearSelect(el) {
  if (!readSelectText(el)) return unchanged();
  if (isNativeSelect(el)) {
    const empty = Array.from(el.options).find((o) => o.value === "");
    if (!empty) return failed("这个下拉框没有空选项，没法自动清空，请手动检查");
    setNativeValue(el, "");
    dispatchChange(el);
    return readSelectText(el) ? failed("清空后回读仍然有值") : restored();
  }
  const clear = el.querySelector(".ant-select-clear");
  if (!clear) return failed("这个下拉框没有清空按钮，没法自动清空，请手动检查");
  hover(el);
  await safeClick(clear);
  await waitFor(() => !readSelectText(el), { timeout: 1000 });
  await closeDropdown(el);
  return readSelectText(el) ? failed("点了清空按钮但下拉框里还有值") : restored();
}

function isSearchable(el) {
  return el.classList.contains("ant-select-show-search");
}

export function snapshotSelect(el) {
  return { text: readSelectText(el) };
}

export async function restoreSelect(el, snapshot) {
  if (normalizeText(readSelectText(el)) === normalizeText(snapshot.text)) return unchanged();
  if (!snapshot.text) return clearSelect(el);
  const result = await chooseFromSelect(el, (texts) => pickBestOption(texts, [snapshot.text]), {
    wantedText: snapshot.text,
    keywords: isSearchable(el) ? [snapshot.text] : null,
  });
  return result.status === "filled" ? restored() : failed(result.reason);
}

/** 普通下拉和可搜索下拉共用的控件处理器。 */
export const selectControl = {
  snapshot: (field) => snapshotSelect(field.element),
  restore: (field, snapshot) => restoreSelect(field.element, snapshot),
  async fill(field, value, resumeField) {
    const wantedText = valueToText(value);
    const candidates = buildCandidates(fieldNameOf(resumeField), wantedText);
    const searchable = field.controlType === "searchable-select" || isSearchable(field.element);
    return chooseFromSelect(field.element, (texts) => pickBestOption(texts, candidates), {
      wantedText,
      keywords: searchable ? searchKeywords(wantedText) : null,
    });
  },
};
