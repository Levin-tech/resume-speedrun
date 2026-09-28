/**
 * 拆分式"开始年/开始月 — 结束年/结束月"下拉组 + "至今"勾选框。
 * 分别在 4 个下拉里点选数字对应的年/月；"至今"为真时勾选"至今"且不填结束时间。
 */

import { safeClick, waitFor } from "../dom-actions.js";
import { pickNumberOption } from "../option-match.js";
import { formatYearMonth } from "../values.js";
import { chooseFromSelect, readSelectText, restoreSelect, isSelectDisabled } from "./select.js";
import { filled, needsConfirmation, failed, restored, unchanged } from "./results.js";

const PART_LABELS = {
  startYear: "开始年份",
  startMonth: "开始月份",
  endYear: "结束年份",
  endMonth: "结束月份",
};

function isBoxChecked(box) {
  if (box.matches('[role="checkbox"]')) return box.getAttribute("aria-checked") === "true";
  if (box.classList.contains("ant-checkbox-wrapper")) {
    return box.classList.contains("ant-checkbox-wrapper-checked");
  }
  const input = box.matches("input") ? box : box.querySelector('input[type="checkbox"]');
  return !!input?.checked;
}

async function setCurrentChecked(box, checked) {
  if (isBoxChecked(box) === checked) return true;
  await safeClick(box);
  return !!(await waitFor(() => isBoxChecked(box) === checked, { timeout: 1000 }));
}

function fillPart(select, number, label) {
  return chooseFromSelect(select, (texts) => pickNumberOption(texts, number), {
    wantedText: `${label} ${number}`,
  });
}

export const dateRangeControl = {
  snapshot(field) {
    const parts = field.subElements;
    return {
      texts: Object.fromEntries(Object.keys(PART_LABELS).map((key) => [key, readSelectText(parts[key])])),
      isCurrent: parts.isCurrent ? isBoxChecked(parts.isCurrent) : null,
    };
  },

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
      const result = await fillPart(parts[key], number, PART_LABELS[key]);
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

  async restore(field, snapshot) {
    const parts = field.subElements;
    const current = this.snapshot(field);
    const same =
      current.isCurrent === snapshot.isCurrent &&
      Object.keys(PART_LABELS).every((key) => current.texts[key] === snapshot.texts[key]);
    if (same) return unchanged();

    const problems = [];
    if (parts.isCurrent && current.isCurrent && !snapshot.isCurrent) {
      if (!(await setCurrentChecked(parts.isCurrent, false))) problems.push("没能取消勾选“至今”");
    }
    for (const key of Object.keys(PART_LABELS)) {
      if (isSelectDisabled(parts[key]) && readSelectText(parts[key]) === snapshot.texts[key]) continue;
      const result = await restoreSelect(parts[key], { text: snapshot.texts[key] });
      if (result.status === "failed") problems.push(`${PART_LABELS[key]}：${result.reason}`);
    }
    if (parts.isCurrent && snapshot.isCurrent && !isBoxChecked(parts.isCurrent)) {
      if (!(await setCurrentChecked(parts.isCurrent, true))) problems.push("没能重新勾选“至今”");
    }
    return problems.length ? failed(problems.join("；")) : restored();
  },
};
