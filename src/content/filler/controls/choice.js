/**
 * 单选 / 多选：组件库的 radio、checkbox，以及网站自己画的 role="radio"/"checkbox"。
 * 像人一样点击看得见的选项，再回读选中状态。
 */

import { safeClick, waitFor } from "../dom-actions.js";
import { buildCandidates, pickBestOption } from "../option-match.js";
import { fieldNameOf, valueToText } from "../values.js";
import { filled, needsConfirmation, skipped, failed, restored, unchanged } from "./results.js";

const ITEM_SELECTOR =
  '.ant-radio-wrapper, .ant-checkbox-wrapper, [role="radio"], [role="checkbox"], label:has(input[type="radio"], input[type="checkbox"])';

function isChecked(item) {
  if (item.matches('[role="radio"], [role="checkbox"]')) return item.getAttribute("aria-checked") === "true";
  if (item.classList.contains("ant-radio-wrapper-checked") || item.classList.contains("ant-checkbox-wrapper-checked")) {
    return true;
  }
  return !!item.querySelector("input:checked");
}

function isDisabled(item) {
  return (
    item.getAttribute("aria-disabled") === "true" ||
    /-wrapper-disabled/.test(item.className) ||
    !!item.querySelector("input:disabled")
  );
}

export function choiceItems(group) {
  const all = Array.from(group.querySelectorAll(ITEM_SELECTOR));
  // 组件库的 wrapper 里面还套着 label/input，去掉嵌套重复的。
  return all
    .filter((item) => !all.some((other) => other !== item && other.contains(item)))
    .map((el) => ({ el, text: el.textContent.trim(), checked: isChecked(el), disabled: isDisabled(el) }));
}

function checkedTexts(group) {
  return choiceItems(group)
    .filter((i) => i.checked)
    .map((i) => i.text);
}

async function setChecked(group, text, checked) {
  const item = choiceItems(group).find((i) => i.text === text);
  if (!item) return false;
  if (item.checked === checked) return true;
  if (item.disabled) return false;
  await safeClick(item.el);
  return !!(await waitFor(() => choiceItems(group).find((i) => i.text === text)?.checked === checked, {
    timeout: 1000,
  }));
}

function sameSet(a, b) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

async function fillRadio(group, value, resumeField) {
  const wantedText = valueToText(value);
  const items = choiceItems(group);
  const pick = pickBestOption(
    items.map((i) => i.text),
    buildCandidates(fieldNameOf(resumeField), wantedText)
  );
  if (!pick) return skipped(`选项里没有「${wantedText}」，没有填`);
  if (items[pick.index].disabled) return failed(`选项「${pick.text}」是禁用的`);
  if (!(await setChecked(group, pick.text, true))) return failed(`点了「${pick.text}」但没有选中`);
  if (pick.exact) return filled(pick.text);
  return needsConfirmation(pick.text, `简历里是「${wantedText}」，选了最接近的「${pick.text}」`);
}

async function fillCheckboxes(group, value, resumeField) {
  const values = (Array.isArray(value) ? value : [value]).map(valueToText).filter(Boolean);
  const texts = choiceItems(group).map((i) => i.text);
  const fieldName = fieldNameOf(resumeField);
  const wanted = new Set();
  const missing = [];
  let allExact = true;
  for (const v of values) {
    const pick = pickBestOption(texts, buildCandidates(fieldName, v));
    if (!pick) missing.push(v);
    else {
      wanted.add(pick.text);
      allExact &&= pick.exact;
    }
  }
  if (wanted.size === 0) return skipped(`选项里没有「${values.join("、")}」，没有填`);

  // 让勾选结果和简历完全一致：该勾的勾上，不该勾的取消。
  for (const text of texts) {
    if (!(await setChecked(group, text, wanted.has(text)))) {
      return failed(`没能${wanted.has(text) ? "勾选" : "取消勾选"}「${text}」`);
    }
  }
  const now = checkedTexts(group);
  if (!sameSet(now, [...wanted])) return failed(`勾选后回读到的是「${now.join("、") || "空"}」`);
  const filledText = now.join("、");
  if (missing.length) return needsConfirmation(filledText, `选项里没有「${missing.join("、")}」`);
  if (!allExact) return needsConfirmation(filledText, "有的选项不是完全一样的写法，选了最接近的");
  return filled(filledText);
}

export const choiceControl = {
  snapshot: (field) => ({ checked: checkedTexts(field.element) }),

  fill(field, value, resumeField) {
    return field.controlType === "radio"
      ? fillRadio(field.element, value, resumeField)
      : fillCheckboxes(field.element, value, resumeField);
  },

  async restore(field, snapshot) {
    const group = field.element;
    const now = checkedTexts(group);
    if (sameSet(now, snapshot.checked)) return unchanged();
    if (field.controlType === "radio") {
      // 单选框一旦选中，页面上就没有"取消选择"的操作，人也做不到。
      if (snapshot.checked.length === 0) {
        return failed("单选项选中后没法取消，只能保持现在的选择，请手动检查");
      }
      return (await setChecked(group, snapshot.checked[0], true)) ? restored() : failed("没能选回原来的选项");
    }
    for (const item of choiceItems(group)) {
      if (!(await setChecked(group, item.text, snapshot.checked.includes(item.text)))) {
        return failed(`没能还原「${item.text}」的勾选状态`);
      }
    }
    return restored();
  },
};
