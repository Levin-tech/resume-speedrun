/**
 * 文本框 / 文本域：原生 setter 赋值，再依次触发 focus、input、change、blur，
 * 让 Vue/React 组件库感知到值变了（直接改 value 属性框架是不知道的）。
 */

import {
  focusElement,
  blurElement,
  setNativeValue,
  dispatchInput,
  dispatchChange,
  tick,
} from "../dom-actions.js";
import { valueToText } from "../values.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

function inputOf(field) {
  if (field.subElements?.input) return field.subElements.input;
  const el = field.element;
  return el.matches("input, textarea") ? el : el.querySelector("input, textarea");
}

async function typeValue(input, text) {
  focusElement(input);
  setNativeValue(input, text);
  dispatchInput(input, text);
  await tick();
  dispatchChange(input);
  blurElement(input);
  // 等框架把自己的状态回写到输入框（受控组件如果拒绝了这个值，会改回去）。
  await tick();
  await tick();
}

export const textControl = {
  snapshot: (field) => ({ value: inputOf(field)?.value ?? "" }),

  async fill(field, value) {
    const input = inputOf(field);
    if (!input) return failed("没找到输入框");
    if (input.disabled || input.readOnly) return failed("输入框是只读的，没法输入");
    const text = Array.isArray(value) && input.tagName === "TEXTAREA" ? value.join("\n") : valueToText(value);
    await typeValue(input, text);
    if (input.value === text) return filled(text);
    if (input.value && text.startsWith(input.value)) {
      return needsConfirmation(input.value, `页面限制了字数，只填进去了前 ${input.value.length} 个字`);
    }
    return failed(`填完后回读到的是「${input.value || "空"}」，和简历不一致`);
  },

  async restore(field, snapshot) {
    const input = inputOf(field);
    if (input.value === snapshot.value) return unchanged();
    await typeValue(input, snapshot.value);
    return input.value === snapshot.value ? restored() : failed("还原后回读不一致");
  },
};
