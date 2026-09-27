/**
 * 填写引擎：把识别结果实际写入页面控件，模拟真实的人工操作
 * （而不是直接改 DOM value，这样才能触发组件库自己的 change 校验）。
 *
 * 每种控件类型对应一个填写函数，统一特点：
 *   - 用真实的鼠标事件/键盘事件序列（mousedown/click、input、change）
 *   - 下拉/日期这类"点开浮层再点选项"的控件，点开后要等浮层渲染出来再点选项
 *   - 填完立刻回读控件当前值，校验是否与目标一致，返回结果供 review 清单使用
 *   - 同一时间只处理一个控件，等上一个的浮层关闭再开始下一个，避免浮层重叠
 *
 * 绝不点击的按钮文案黑名单，见 SUBMIT_LIKE_BLACKLIST，任何"添加新一段经历"
 * 之外的按钮点击都要先检查不在这个黑名单里。
 */

/** 永远不允许 filler 自动点击的按钮文案关键词（避免误触发提交/删除）。 */
export const SUBMIT_LIKE_BLACKLIST = [
  "提交",
  "保存",
  "下一步",
  "确认",
  "投递",
  "删除",
  "移除",
  "确定投递",
];

/**
 * @typedef {Object} FillResult
 * @property {string} fieldId
 * @property {'filled'|'needs-confirmation'|'skipped'|'failed'} status
 * @property {string} [reason]
 */

/**
 * 按照 matcher 给出的匹配结果，逐项调用对应控件类型的填写函数。
 * 必须逐项串行执行（不要 Promise.all 并发），避免多个下拉浮层同时打开。
 * @param {import('../scanner/scanner.js').FormField[]} fields
 * @param {import('../matcher/matcher.js').MatchResult[]} matches
 * @param {import('../../shared/schema/resume.js').ResumeProfile} profile
 * @returns {Promise<FillResult[]>}
 */
export async function fillFields(fields, matches, profile) {
  void profile;
  const results = [];
  for (const match of matches) {
    const field = fields.find((f) => f.id === match.fieldId);
    if (!field || !match.resumeField) {
      results.push({ fieldId: match.fieldId, status: "skipped" });
      continue;
    }
    // TODO(第 1 阶段): 按 field.controlType 分派到下面各个占位函数。
    results.push({ fieldId: match.fieldId, status: "skipped" });
  }
  return results;
}

/** 文本框：聚焦、逐字符 input 事件、失焦触发校验。 */
export async function fillTextInput(element, value) {
  void element;
  void value;
}

/** 组件库下拉：点开触发器 -> 等浮层出现 -> 点选项 -> 等浮层关闭。 */
export async function fillSelect(element, optionText) {
  void element;
  void optionText;
}

/** 可搜索下拉：聚焦输入关键词 -> 等候选列表出现 -> 点选目标候选项。 */
export async function fillSearchableSelect(element, queryText, optionText) {
  void element;
  void queryText;
  void optionText;
}

/** 日期选择器（含"年/月—年/月"拆分下拉 + "至今"勾选框）。 */
export async function fillDateRange(element, startDate, endDate, isCurrent) {
  void element;
  void startDate;
  void endDate;
  void isCurrent;
}

/** 城市级联选择器：逐级点开并选中。 */
export async function fillCascader(element, pathTexts) {
  void element;
  void pathTexts;
}

/** 自定义单选/多选控件。 */
export async function fillChoice(element, optionTexts) {
  void element;
  void optionTexts;
}

/**
 * 点击某个重复区块内的"添加"按钮（教育经历/实习经历等新增一段）。
 * 调用前必须确认按钮文案不在 SUBMIT_LIKE_BLACKLIST 中。
 */
export async function clickAddEntryButton(buttonElement) {
  void buttonElement;
}
