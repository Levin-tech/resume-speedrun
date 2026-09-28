/**
 * "年"、"月"两个下拉组成的单个年月（如毕业时间、到岗时间）。
 * 下拉具体怎么点由传入的 SelectOps 决定。
 */

import { formatYearMonth } from "../values.js";
import { chooseNumber } from "./date-range.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const PART_LABELS = { year: "年份", month: "月份" };

/** @param {import('./select.js').SelectOps} ops */
export function createYearMonthControl(ops) {
  const snapshot = (field) => ({
    texts: Object.fromEntries(Object.keys(PART_LABELS).map((key) => [key, ops.readText(field.subElements[key])])),
  });

  return {
    snapshot,

    async fill(field, value) {
      const problems = [];
      let doneCount = 0;
      for (const key of Object.keys(PART_LABELS)) {
        if (!value?.[key]) {
          problems.push(`${PART_LABELS[key]}简历里没有`);
          continue;
        }
        const result = await chooseNumber(ops, field.subElements[key], value[key], PART_LABELS[key]);
        if (result.status === "filled") doneCount += 1;
        else problems.push(`${PART_LABELS[key]}：${result.reason}`);
      }
      const summary = formatYearMonth(value);
      if (problems.length === 0) return filled(summary);
      if (doneCount === 0) return failed(problems.join("；"));
      return needsConfirmation(summary, `部分没填上：${problems.join("；")}`);
    },

    async restore(field, before) {
      const current = snapshot(field);
      if (Object.keys(PART_LABELS).every((key) => current.texts[key] === before.texts[key])) return unchanged();
      const problems = [];
      for (const key of Object.keys(PART_LABELS)) {
        const result = await ops.restore(field.subElements[key], { text: before.texts[key] });
        if (result.status === "failed") problems.push(`${PART_LABELS[key]}：${result.reason}`);
      }
      return problems.length ? failed(problems.join("；")) : restored();
    },
  };
}
