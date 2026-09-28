/**
 * Moka 的 location_info（籍贯、所在地）：只读输入框，mousedown 打开 menu-wrapper 面板，
 * 有"热门地区"标签（sd-Tag）和"省份/城市/县区"三个页签，逐级点选。
 * 简历里只写了"深圳"这种城市名时，先看热门地区，没有再像人一样挨个省份展开找。
 */

import { safeClick, waitFor, waitForSettled } from "../dom-actions.js";
import { normalizeText, pickBestOption, splitCascaderPath, stripAdminSuffix } from "../option-match.js";
import { findMokaOverlay, openMokaOverlay, closeMokaOverlay, clearMokaInput, outermost } from "./moka-select.js";
import { filled, needsConfirmation, skipped, failed, restored, unchanged } from "./results.js";

const PANEL = '[class*="menu-wrapper"]';
const TAB_TEXT = /^(省份|省|城市|市|县区|区县|区|地区)$/;

const panelOf = (input) => findMokaOverlay(input, PANEL);

const toItem = (el) => ({ el, text: el.textContent.trim() });

function tabs(panel) {
  return Array.from(panel?.querySelectorAll('[class*="tab"]') ?? []).filter(
    (el) => el.children.length === 0 && TAB_TEXT.test(el.textContent.trim())
  );
}

function hotTags(panel) {
  return outermost(Array.from(panel?.querySelectorAll('[class*="sd-Tag"]') ?? [])).map(toItem);
}

/** 当前页签下可以点的地名。 */
function levelItems(panel) {
  const inOtherPart = (el) => {
    const part = el.closest('[class*="sd-Tag"], [class*="hot"], [class*="tab"]');
    return !!part && panel.contains(part);
  };
  const all = Array.from(panel?.querySelectorAll('[class*="item"], li') ?? []).filter(
    (el) => !inOtherPart(el) && el.textContent.trim()
  );
  return all.filter((el) => !all.some((other) => other !== el && el.contains(other))).map(toItem);
}

function panelState(input) {
  const panel = panelOf(input);
  if (!panel) return "closed";
  const active = tabs(panel).find((t) => /active|selected|current/i.test(t.className));
  return `${active?.textContent ?? ""}|${levelItems(panel)
    .map((i) => i.text)
    .join(",")}`;
}

/** 点一个地名/热门标签，等面板换到下一级（或关闭）。 */
async function clickLevel(input, item) {
  const before = panelState(input);
  await safeClick(item.el);
  await waitFor(() => panelState(input) !== before, { timeout: 1500 });
  const panel = panelOf(input);
  if (panel) await waitForSettled(panel, { quietMs: 60, timeout: 600 });
}

async function gotoFirstTab(input) {
  const first = tabs(panelOf(input))[0];
  if (first && !/active|selected|current/i.test(first.className)) await clickLevel(input, toItem(first));
}

const sameArea = (a, b) => stripAdminSuffix(a) === stripAdminSuffix(b);

/** 按完整路径逐级点；路径比级数短时，下一级只有同名的一项就顺手点上（"北京" -> 北京市/北京市）。 */
async function followPath(input, tokens) {
  const path = [];
  let exact = true;
  for (const token of tokens) {
    const items = levelItems(panelOf(input));
    if (!items.length) break;
    const pick = pickBestOption(
      items.map((i) => i.text),
      [token]
    );
    if (!pick) return path.length ? { path, exact: false } : null;
    exact &&= pick.exact;
    path.push(pick.text);
    await clickLevel(input, items[pick.index]);
  }
  const next = levelItems(panelOf(input));
  const same = next.find((i) => sameArea(i.text, path.at(-1) ?? ""));
  if (same && next.length === 1) {
    path.push(same.text);
    await clickLevel(input, same);
  }
  return { path, exact };
}

async function searchByName(input, token) {
  const hot = hotTags(panelOf(input));
  const hotPick = pickBestOption(
    hot.map((i) => i.text),
    [token]
  );
  if (hotPick?.exact) {
    await clickLevel(input, hot[hotPick.index]);
    return { path: [hotPick.text], exact: true };
  }

  await gotoFirstTab(input);
  const provinces = levelItems(panelOf(input));
  const direct = pickBestOption(
    provinces.map((i) => i.text),
    [token]
  );
  if (direct?.exact) return followPath(input, [token]);

  for (let index = 0; index < provinces.length; index += 1) {
    await gotoFirstTab(input);
    const province = levelItems(panelOf(input))[index];
    if (!province) break;
    await clickLevel(input, province);
    const cities = levelItems(panelOf(input));
    const pick = pickBestOption(
      cities.map((i) => i.text),
      [token]
    );
    if (pick?.exact) {
      await clickLevel(input, cities[pick.index]);
      return { path: [province.text, pick.text], exact: true };
    }
  }
  return null;
}

const lastSegment = (text) => text.split(/[/／>\-\s]+/).filter(Boolean).at(-1) ?? "";

export async function fillMokaLocation(input, value) {
  if (input.disabled) return failed("地区输入框是禁用状态");
  const tokens = splitCascaderPath(value);
  const wanted = tokens.join("/");
  const before = input.value;
  if (!(await openMokaOverlay(input, PANEL))) return failed("点开地区输入框后没有出现地区面板");

  if (tokens.length > 1) await gotoFirstTab(input);
  const result = tokens.length > 1 ? await followPath(input, tokens) : await searchByName(input, tokens[0]);
  await closeMokaOverlay(input, PANEL);

  if (!result) {
    // 挨个省份找的时候页面可能已经记下了点过的省份，找不到就清回原样。
    if (!before && input.value) await clearMokaInput(input, { what: "地区输入框" });
    return skipped(`地区选项里找不到「${wanted}」，没有填`);
  }
  const now = input.value.trim();
  if (!sameArea(lastSegment(now), result.path.at(-1))) {
    return failed(`选了「${result.path.join("/")}」，但回读到的是「${now || "空"}」`);
  }
  const exact = result.exact && sameArea(result.path.at(-1), tokens.at(-1));
  if (exact) return filled(now);
  return needsConfirmation(now, `简历里是「${wanted}」，选了最接近的「${now}」`);
}

export const mokaLocationControl = {
  snapshot: (field) => ({ text: field.subElements.input.value }),

  fill: (field, value) => fillMokaLocation(field.subElements.input, value),

  async restore(field, snapshot) {
    const input = field.subElements.input;
    if (normalizeText(input.value) === normalizeText(snapshot.text)) return unchanged();
    if (!snapshot.text) {
      const result = await clearMokaInput(input, { what: "地区输入框" });
      await closeMokaOverlay(input, PANEL);
      return result;
    }
    const result = await fillMokaLocation(input, snapshot.text.split("/"));
    return result.status === "filled" ? restored() : failed(result.reason);
  },
};
