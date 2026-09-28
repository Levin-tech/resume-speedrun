/**
 * 填写引擎：把识别结果实际写入页面控件，模拟真实的人工操作
 * （而不是直接改 DOM value，这样才能触发组件库自己的 change 校验）。
 *
 *   - 用真实的鼠标/键盘事件序列（见 dom-actions.js）
 *   - 下拉/日期/级联这类控件：点开 -> 等浮层 -> 点选项 -> 等浮层关闭 -> 回读校验
 *   - 严格串行：一个控件的浮层关闭后才处理下一个，避免浮层互相遮挡
 *   - 每项返回 已填/需确认/未填 及原因，交给 review 清单
 *   - 填写前记录每项原来的状态，支持"撤销本次填写"
 *
 * 绝不点击的按钮文案黑名单见 SUBMIT_LIKE_BLACKLIST（定义在 dom-actions.js，
 * 所有点击都经过那里的 safeClick 检查）。
 */

import {
  SUBMIT_LIKE_BLACKLIST,
  ClickBlockedError,
  getClickBlockReason,
  safeClick,
  clickOutside,
  isVisible,
  waitFor,
  waitForSettled,
} from "./dom-actions.js";
import { resolveResumeValue, isEmptyValue } from "./values.js";
import { textControl } from "./controls/text.js";
import { selectControl } from "./controls/select.js";
import { dateControl } from "./controls/date.js";
import { dateRangeControl } from "./controls/date-range.js";
import { cascaderControl } from "./controls/cascader.js";
import { choiceControl } from "./controls/choice.js";
import { mokaSelectControl, mokaYearMonthControl, mokaDateRangeControl } from "./controls/moka-select.js";
import { mokaSuggestControl } from "./controls/moka-suggest.js";
import { mokaBirthdayControl } from "./controls/moka-birthday.js";
import { mokaLocationControl } from "./controls/moka-location.js";

export { SUBMIT_LIKE_BLACKLIST };

/**
 * @typedef {Object} FillResult
 * @property {string} fieldId
 * @property {'filled'|'needs-confirmation'|'skipped'|'failed'} status
 * @property {string} [reason] 需确认/未填的原因（中文，直接展示给用户）
 * @property {string} [filledText] 实际填进去的文字
 * @property {string} label
 * @property {string} sectionTitle
 * @property {number} sectionIndex
 * @property {boolean} repeatable 是否属于可重复的经历区块
 * @property {boolean} required
 * @property {string} controlType
 * @property {string|null} resumeField
 */

/**
 * @typedef {Object} UndoEntry
 * @property {import('../scanner/scanner.js').FormField} field
 * @property {object} snapshot 填写前的状态
 */

const CONTROL_HANDLERS = {
  text: textControl,
  textarea: textControl,
  select: selectControl,
  "searchable-select": selectControl,
  date: dateControl,
  "date-range-group": dateRangeControl,
  cascader: cascaderControl,
  radio: choiceControl,
  checkbox: choiceControl,
};

/** 平台自研组件库的控件处理器（field.kit 由平台适配器扫描时标上）。 */
const KIT_HANDLERS = {
  moka: {
    text: textControl,
    textarea: textControl,
    select: mokaSelectControl,
    suggest: mokaSuggestControl,
    "year-month": mokaYearMonthControl,
    "date-range-group": mokaDateRangeControl,
    date: mokaBirthdayControl,
    cascader: mokaLocationControl,
  },
};

function handlerFor(field) {
  if (field.kit) return KIT_HANDLERS[field.kit]?.[field.controlType] ?? null;
  return CONTROL_HANDLERS[field.controlType] ?? null;
}

const OVERLAY_SELECTOR = [
  ".ant-select-dropdown",
  ".ant-picker-dropdown",
  ".ant-cascader-dropdown",
  '[class*="apply-field"] [class*="sd-Dropdown-dropdown"]',
  '[class*="apply-field"] [class*="menu-wrapper"]',
].join(", ");

/** 保证页面上没有还开着的浮层，再开始下一个控件。 */
async function ensureOverlaysClosed() {
  const anyOpen = () => Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).some(isVisible);
  if (!anyOpen()) return;
  await clickOutside();
  await waitFor(() => !anyOpen(), { timeout: 2000 });
}

function describeField(field, match) {
  return {
    fieldId: field.id,
    label: field.label,
    sectionTitle: field.sectionTitle,
    sectionIndex: field.sectionIndex,
    repeatable: !!field.container,
    required: field.required,
    controlType: field.controlType,
    resumeField: match?.resumeField ?? null,
  };
}

/**
 * 按照 matcher 给出的匹配结果，逐项填写。严格串行（不要 Promise.all）。
 * @param {import('../scanner/scanner.js').FormField[]} fields
 * @param {import('../matcher/matcher.js').MatchResult[]} matches
 * @param {import('../../shared/schema/resume.js').ResumeProfile} profile
 * @param {{ journal?: UndoEntry[] }} [options] journal 用来收集撤销记录
 * @returns {Promise<FillResult[]>}
 */
export async function fillFields(fields, matches, profile, { journal = [] } = {}) {
  const results = [];
  for (const field of fields) {
    const match = matches.find((m) => m.fieldId === field.id);
    const base = describeField(field, match);
    const skip = (reason) => results.push({ ...base, status: "skipped", reason });

    if (field.skipReason) {
      skip(field.skipReason);
      continue;
    }
    if (match?.unavailable) {
      skip("信息库无此项，请手动填写");
      continue;
    }
    if (!match?.resumeField) {
      skip("没认出这一项对应简历里的哪个字段，请手动填写");
      continue;
    }
    const { value, missingEntry } = resolveResumeValue(profile, match.resumeField);
    if (missingEntry) {
      skip(`简历里没有第 ${field.sectionIndex + 1} 段${field.sectionTitle || "经历"}`);
      continue;
    }
    if (isEmptyValue(value)) {
      skip("简历里这一项是空的");
      continue;
    }
    const handler = handlerFor(field);
    if (!handler) {
      skip("暂不支持这种控件，请手动填写");
      continue;
    }
    if (!field.element.isConnected) {
      results.push({ ...base, status: "failed", reason: "控件已经不在页面上了" });
      continue;
    }

    journal.push({ field, snapshot: handler.snapshot(field) });
    let outcome;
    try {
      outcome = await handler.fill(field, value, match.resumeField);
    } catch (error) {
      outcome = {
        status: "failed",
        reason: error instanceof ClickBlockedError ? error.message : `填写时出错：${error.message}`,
      };
    }
    await ensureOverlaysClosed();
    results.push({ ...base, ...outcome });
  }
  return results;
}

/**
 * 撤销：按填写的倒序，把每个控件还原成填写前的状态。
 * @param {UndoEntry[]} journal
 * @returns {Promise<Array<FillResult & { status: 'restored'|'unchanged'|'failed' }>>}
 */
export async function undoFill(journal) {
  const results = [];
  for (const { field, snapshot } of [...journal].reverse()) {
    const base = describeField(field, null);
    if (!field.element.isConnected) {
      results.push({ ...base, status: "failed", reason: "控件已经不在页面上了" });
      continue;
    }
    let outcome;
    try {
      outcome = await handlerFor(field).restore(field, snapshot);
    } catch (error) {
      outcome = { status: "failed", reason: `还原时出错：${error.message}` };
    }
    await ensureOverlaysClosed();
    results.push({ ...base, ...outcome });
  }
  return results.reverse();
}

const ADD_BUTTON_WORDS = ["添加", "新增", "增加", "再加一"];
const REPEATABLE_ARRAYS = {
  education: "教育经历",
  workExperiences: "工作经历",
  internships: "实习经历",
  projects: "项目经历",
};

/**
 * 在重复区块里找"添加/新增"按钮，命中黑名单的按钮直接跳过。
 * @param {Element|null} sectionContainer
 * @returns {HTMLElement|null}
 */
export function findAddEntryButton(sectionContainer) {
  if (!sectionContainer) return null;
  const buttons = sectionContainer.querySelectorAll('button, .ant-btn, [role="button"]');
  for (const button of buttons) {
    const text = button.textContent.trim();
    if (!ADD_BUTTON_WORDS.some((w) => text.includes(w))) continue;
    if (getClickBlockReason(button)) continue;
    return button;
  }
  return null;
}

/**
 * 点击某个重复区块内的"添加"按钮（教育经历/实习经历等新增一段）。
 * 点击前再检查一遍按钮不在 SUBMIT_LIKE_BLACKLIST 中。
 */
export async function clickAddEntryButton(buttonElement) {
  const text = buttonElement.textContent.trim();
  if (!ADD_BUTTON_WORDS.some((w) => text.includes(w))) {
    throw new ClickBlockedError(`按钮「${text}」不是"添加"类按钮，插件不会点击`);
  }
  await safeClick(buttonElement);
}

/**
 * 页面上一个可重复的经历区块。平台适配器能直接给出（连一段都还没有的区块也算），
 * 没有适配器时从扫描结果推断。
 * @typedef {Object} RepeatableSection
 * @property {string} arrayName 用简历里的哪个经历数组来填，如 "internships"
 * @property {string} title 区块标题
 * @property {Element|null} container
 * @property {() => number} countEntries 页面上现在有几段
 * @property {() => HTMLElement|null} findAddButton
 */

/** @returns {RepeatableSection[]} */
function inferSections(fields, matches) {
  const sections = [];
  for (const arrayName of Object.keys(REPEATABLE_ARRAYS)) {
    const sectionFields = fields.filter((f) =>
      matches.find((m) => m.fieldId === f.id)?.resumeField?.startsWith(`${arrayName}[`)
    );
    if (sectionFields.length === 0) continue;
    const onPage = Math.max(...sectionFields.map((f) => f.sectionIndex)) + 1;
    const container = sectionFields.find((f) => f.container)?.container ?? null;
    const initialChildren = container?.children.length ?? 0;
    sections.push({
      arrayName,
      title: sectionFields[0].sectionTitle,
      container,
      countEntries: () => onPage + (container ? container.children.length - initialChildren : 0),
      findAddButton: () =>
        findAddEntryButton(container) || findAddEntryButton(container?.closest(".ant-card, section, fieldset")),
    });
  }
  return sections;
}

/**
 * 简历有 N 段经历、页面只有 M 段时，点 N-M 次对应区块的"添加"按钮，
 * 每次都等新的一段出现。调用方随后要重新扫描再填写。
 * @param {RepeatableSection[]|null} [sections] 平台适配器给出的区块；不给就从扫描结果推断
 * @returns {Promise<{ added: number, results: FillResult[] }>}
 */
export async function expandRepeatableSections(fields, matches, profile, sections = null) {
  let added = 0;
  const results = [];
  const done = new Set();
  for (const section of sections ?? inferSections(fields, matches)) {
    const { arrayName } = section;
    const title = REPEATABLE_ARRAYS[arrayName];
    const wanted = profile?.[arrayName]?.length ?? 0;
    if (!title || done.has(arrayName) || wanted === 0) continue;
    done.add(arrayName);

    const onPage = section.countEntries();
    const note = (reason) =>
      results.push({
        fieldId: `add-${arrayName}`,
        label: `${title}（第 ${onPage + 1}~${wanted} 段）`,
        sectionTitle: section.title,
        sectionIndex: onPage,
        repeatable: false,
        required: false,
        controlType: "add-button",
        resumeField: arrayName,
        status: "skipped",
        reason,
      });

    for (let count = onPage; count < wanted; count += 1) {
      const button = section.findAddButton();
      if (!button) {
        note(`简历有 ${wanted} 段，页面只有 ${count} 段，没找到"添加"按钮，请手动添加后再填一次`);
        break;
      }
      try {
        await clickAddEntryButton(button);
      } catch (error) {
        note(error.message);
        break;
      }
      if (!(await waitFor(() => section.countEntries() > count))) {
        note(`点了"${button.textContent.trim()}"但没有出现新的一段`);
        break;
      }
      await waitForSettled(section.container, { quietMs: 100, timeout: 1500 });
      added += 1;
    }
  }
  return { added, results };
}
