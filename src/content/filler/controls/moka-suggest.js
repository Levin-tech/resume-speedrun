/**
 * Moka 的"输入后出联想候选"输入框（学校名称、专业名称、最近毕业专业）：
 * string_info 字段里带 sd-Dropdown。打字 -> 等候选列表 -> 点最匹配的候选；
 * 一个候选都没有时，保留输入的文字并标"需确认"。
 */

import { safeClick, blurElement, dispatchChange, typeText, tick, waitFor, waitForSettled } from "../dom-actions.js";
import { normalizeText, pickBestOption } from "../option-match.js";
import { valueToText } from "../values.js";
import { findMokaOverlay, closeMokaOverlay, menuItems } from "./moka-select.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const CANDIDATE_TIMEOUT = 2000;

async function finishTyping(input) {
  await closeMokaOverlay(input);
  dispatchChange(input);
  blurElement(input);
  await tick();
}

export const mokaSuggestControl = {
  snapshot: (field) => ({ value: field.subElements.input.value }),

  async fill(field, value) {
    const input = field.subElements.input;
    if (input.disabled || input.readOnly) return failed("输入框是只读的，没法输入");
    const text = valueToText(value);
    typeText(input, text);

    const withItems = () => {
      const dropdown = findMokaOverlay(input);
      return dropdown && menuItems(dropdown).length ? dropdown : null;
    };
    const dropdown = await waitFor(withItems, { timeout: CANDIDATE_TIMEOUT });
    let pick = null;
    if (dropdown) {
      await waitForSettled(dropdown, { quietMs: 80, timeout: 1000 });
      const items = menuItems(findMokaOverlay(input));
      pick = pickBestOption(
        items.map((i) => i.text),
        [text]
      );
      if (pick) {
        await safeClick(items[pick.index].el);
        await waitFor(() => !findMokaOverlay(input), { timeout: 1500 });
      }
    }
    await finishTyping(input);

    const now = input.value;
    if (pick) {
      if (normalizeText(now) !== normalizeText(pick.text)) {
        return failed(`点了候选「${pick.text}」，但回读到的是「${now || "空"}」`);
      }
      if (pick.exact) return filled(now);
      return needsConfirmation(now, `简历里是「${text}」，候选里没有完全一样的，选了最接近的「${now}」`);
    }
    if (now !== text) return failed(`填完后回读到的是「${now || "空"}」，和简历不一致`);
    return needsConfirmation(now, "没有找到匹配的候选项，保留了输入的文字，请确认网站接受这个写法");
  },

  async restore(field, snapshot) {
    const input = field.subElements.input;
    if (input.value === snapshot.value) return unchanged();
    typeText(input, snapshot.value);
    await tick();
    await finishTyping(input);
    return input.value === snapshot.value ? restored() : failed("还原后回读不一致");
  },
};
