/**
 * 填后检查清单：把 filler 的填写结果整理成"已填/需确认/未填"三档，
 * 并标出简历里标记为必填但未成功填写的项，渲染成一个悬浮面板。
 * 用户看完确认没问题后，自己点页面上的提交按钮——本插件绝不代为点击。
 *
 * 第 0 阶段只搭建数据整理和渲染入口，具体 UI 留到后续阶段实现。
 */

/**
 * @typedef {Object} ReviewSummary
 * @property {import('../filler/filler.js').FillResult[]} filled
 * @property {import('../filler/filler.js').FillResult[]} needsConfirmation
 * @property {import('../filler/filler.js').FillResult[]} skipped
 * @property {string[]} missingRequiredFields 必填但未填的简历字段路径
 */

/**
 * @param {import('../filler/filler.js').FillResult[]} fillResults
 * @param {string[]} requiredFieldPaths
 * @returns {ReviewSummary}
 */
export function summarizeFillResults(fillResults, requiredFieldPaths = []) {
  const filled = fillResults.filter((r) => r.status === "filled");
  const needsConfirmation = fillResults.filter(
    (r) => r.status === "needs-confirmation"
  );
  const skipped = fillResults.filter(
    (r) => r.status === "skipped" || r.status === "failed"
  );
  // TODO(第 1 阶段): 结合 matcher 的 resumeField 对照 requiredFieldPaths，
  // 找出真正"必填但没填上"的字段，而不仅仅是 skipped 列表。
  void requiredFieldPaths;
  return { filled, needsConfirmation, skipped, missingRequiredFields: [] };
}

/**
 * 在页面上渲染检查清单悬浮面板。
 * @param {ReviewSummary} summary
 */
export function renderReviewPanel(summary) {
  // TODO(第 1 阶段): 挂载一个 Shadow DOM 悬浮面板展示 summary。
  void summary;
}
