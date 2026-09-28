/**
 * 拆分式"开始年/开始月 — 结束年/结束月"下拉组 + "至今"勾选框。
 * 分别在 4 个下拉里点选数字对应的年/月；"至今"为真时勾选"至今"且不填结束时间。
 * 下拉具体怎么点由传入的 SelectOps 决定（Ant Design、Moka 各一套）。
 */

import { safeClick, waitFor } from "../dom-actions.js";
import { pickNumberOption } from "../option-match.js";
import { formatYearMonth } from "../values.js";
import { antSelectOps } from "./select.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const PART_LABELS = {
  startYear: "开始年份",
  startMonth: "开始月份",
  endYear: "结束年份",
  endMonth: "结束月份",
};

const CHECKED_CLASS = /(^|[\s_-])checked([\s_-]|$)/i;

function isBoxChecked(box) {
  if (box.matches('[role="checkbox"]')) return box.getAttribute("aria-checked") === "true";
  if (box.classList.contains("ant-checkbox-wrapper")) {
    return box.classList.contains("ant-checkbox-wrapper-checked");
  }
  const input = box.matches("input") ? box : box.querySelector('input[type="checkbox"]');
  if (input) return input.checked;
  // 没有原生勾选框的自绘组件，看类名里有没有 checked（如 sd-Checkbox-checked-xxxx）。
  return CHECKED_CLASS.test(box.className) || !!box.querySelector('[class*="checked"]:not([class*="unchecked"])');
}

async function setCurrentChecked(box, checked) {
  if (isBoxChecked(box) === checked) return true;
  await safeClick(box);
  return !!(await waitFor(() => isBoxChecked(box) === checked, { timeout: 1000 }));
}

/** 在年份/月份下拉里选中数字 number；能打字过滤的（如 Moka 的"年"）先输入再点。 */
export function chooseNumber(ops, select, number, label) {
  return ops.choose(select, (texts) => pickNumberOption(texts, number), {
    wantedText: `${label} ${number}`,
    keywords: ops.isSearchable(select) ? [String(number)] : null,
  });
}

/** @param {import('./select.js').SelectOps} ops */
export function createDateRangeControl(ops) {
  const snapshot = (field) => {
    const parts = field.subElements;
    return {
      texts: Object.fromEntries(Object.keys(PART_LABELS).map((key) => [key, ops.readText(parts[key])])),
      isCurrent: parts.isCurrent ? isBoxChecked(parts.isCurrent) : null,
    };
  };

  return {
    snapshot,

    async fill(field, value) {
      const parts = field.subElements;
      const { startDate, endDate, isCurrent } = value;
      const problems = [];
      let doneCount = 0;

      const run = async (key, number) => {
        if (!number) {
          problems.push(`${PART_LABELS[key]}简历里没有`);
          return;
        }
        const result = await chooseNumber(ops, parts[key], number, PART_LABELS[key]);
        if (result.status === "filled") doneCount += 1;
        else problems.push(`${PART_LABELS[key]}：${result.reason}`);
      };

      await run("startYear", startDate?.year);
      await run("startMonth", startDate?.month);

      if (isCurrent) {
        if (!parts.isCurrent) {
          problems.push("页面上没找到“至今”选项，结束时间没填");
        } else if (await setCurrentChecked(parts.isCurrent, true)) {
          doneCount += 1;
        } else {
          problems.push("没能勾选“至今”");
        }
      } else {
        // 先取消"至今"，结束时间下拉才会解除禁用。
        if (parts.isCurrent && !(await setCurrentChecked(parts.isCurrent, false))) {
          problems.push("没能取消勾选“至今”");
        }
        await run("endYear", endDate?.year);
        await run("endMonth", endDate?.month);
      }

      const summary = `${formatYearMonth(startDate)} ~ ${isCurrent ? "至今" : formatYearMonth(endDate)}`;
      if (problems.length === 0) return filled(summary);
      if (doneCount === 0) return failed(problems.join("；"));
      return needsConfirmation(summary, `部分没填上：${problems.join("；")}`);
    },

    async restore(field, before) {
      const parts = field.subElements;
      const current = snapshot(field);
      const same =
        current.isCurrent === before.isCurrent &&
        Object.keys(PART_LABELS).every((key) => current.texts[key] === before.texts[key]);
      if (same) return unchanged();

      const problems = [];
      if (parts.isCurrent && current.isCurrent && !before.isCurrent) {
        if (!(await setCurrentChecked(parts.isCurrent, false))) problems.push("没能取消勾选“至今”");
      }
      for (const key of Object.keys(PART_LABELS)) {
        if (ops.isDisabled(parts[key]) && ops.readText(parts[key]) === before.texts[key]) continue;
        const result = await ops.restore(parts[key], { text: before.texts[key] });
        if (result.status === "failed") problems.push(`${PART_LABELS[key]}：${result.reason}`);
      }
      if (parts.isCurrent && before.isCurrent && !isBoxChecked(parts.isCurrent)) {
        if (!(await setCurrentChecked(parts.isCurrent, true))) problems.push("没能重新勾选“至今”");
      }
      return problems.length ? failed(problems.join("；")) : restored();
    },
  };
}

export const dateRangeControl = createDateRangeControl(antSelectOps);
