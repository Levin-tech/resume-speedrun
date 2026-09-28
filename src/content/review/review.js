/**
 * 填后检查清单：把 filler 的填写结果整理成"已填/需确认/未填"三档，
 * 必填但没填上的项置顶，渲染成页面右上角的悬浮面板（Shadow DOM，
 * 不受网站样式影响）。点条目滚动到对应字段；提供"撤销本次填写"。
 * 用户看完确认没问题后，自己点页面上的提交按钮——本插件绝不代为点击。
 */

/**
 * @typedef {import('../filler/filler.js').FillResult} FillResult
 * @typedef {Object} ReviewSummary
 * @property {FillResult[]} filled
 * @property {FillResult[]} needsConfirmation
 * @property {FillResult[]} skipped 未填（含 failed）
 * @property {FillResult[]} missingRequired 必填但没填上的项
 * @property {FillResult[]} items 按展示顺序排好的全部条目
 */

const isUnfilled = (r) => r.status === "skipped" || r.status === "failed";

function rank(result) {
  if (result.required && isUnfilled(result)) return 0;
  if (result.status === "needs-confirmation") return 1;
  if (isUnfilled(result)) return 2;
  return 3;
}

/** 展示顺序：必填未填 > 需确认 > 未填 > 已填，同档内保持页面顺序。 */
export function orderReviewItems(results) {
  return results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => rank(a.result) - rank(b.result) || a.index - b.index)
    .map(({ result }) => result);
}

/**
 * @param {FillResult[]} fillResults
 * @returns {ReviewSummary}
 */
export function summarizeFillResults(fillResults) {
  return {
    filled: fillResults.filter((r) => r.status === "filled"),
    needsConfirmation: fillResults.filter((r) => r.status === "needs-confirmation"),
    skipped: fillResults.filter(isUnfilled),
    missingRequired: fillResults.filter((r) => r.required && isUnfilled(r)),
    items: orderReviewItems(fillResults),
  };
}

/** 条目标题："实习经历 第 2 段 · 公司名称"。 */
export function itemTitle(result) {
  const label = result.label || "（没有标签的输入项）";
  if (result.repeatable && result.sectionTitle) {
    return `${result.sectionTitle} 第 ${result.sectionIndex + 1} 段 · ${label}`;
  }
  return label;
}

const STATUS_TEXT = {
  filled: "已填",
  "needs-confirmation": "需确认",
  skipped: "未填",
  failed: "未填",
};

const STYLE = `
  :host { all: initial; }
  .panel {
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    width: 340px; max-height: calc(100vh - 32px); display: flex; flex-direction: column;
    background: #fff; color: #1f1f1f; border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,.18); border: 1px solid #e5e5e5;
    font: 13px/1.5 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  header { display: flex; align-items: center; padding: 10px 12px 6px; }
  h2 { font-size: 15px; margin: 0; flex: 1; }
  .icon-btn { border: 0; background: none; font-size: 18px; cursor: pointer; color: #888; }
  .counts { display: flex; gap: 6px; padding: 0 12px 6px; }
  .chip { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
  .chip.filled { background: #f6ffed; color: #389e0d; }
  .chip.confirm { background: #fffbe6; color: #d48806; }
  .chip.unfilled { background: #fff1f0; color: #cf1322; }
  .notice { margin: 0 12px 6px; padding: 6px 8px; border-radius: 6px; background: #f0f5ff; color: #1d39c4; font-size: 12px; }
  .notice.warn { background: #fff1f0; color: #cf1322; }
  ul { list-style: none; margin: 0; padding: 0 8px; overflow-y: auto; flex: 1; }
  li { display: flex; gap: 8px; padding: 6px 6px; border-radius: 6px; cursor: pointer; border-left: 4px solid transparent; margin-bottom: 2px; }
  li:hover { background: #fafafa; }
  li.status-filled { border-left-color: #52c41a; }
  li.status-needs-confirmation { border-left-color: #faad14; background: #fffbe6; }
  li.status-skipped, li.status-failed { border-left-color: #ff4d4f; background: #fff1f0; }
  li.status-restored, li.status-unchanged { border-left-color: #bfbfbf; }
  .tag { flex: 0 0 auto; font-size: 11px; padding: 0 6px; border-radius: 4px; height: 18px; line-height: 18px; color: #fff; }
  .tag.filled { background: #52c41a; } .tag.needs-confirmation { background: #faad14; }
  .tag.skipped, .tag.failed { background: #ff4d4f; } .tag.restored, .tag.unchanged { background: #8c8c8c; }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; word-break: break-all; }
  .required { color: #cf1322; font-size: 11px; margin-left: 4px; font-weight: 400; }
  .detail { color: #595959; font-size: 12px; word-break: break-all; }
  footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 12px 12px; border-top: 1px solid #f0f0f0; }
  .footnote { flex-basis: 100%; color: #8c8c8c; font-size: 12px; }
  footer button { flex: 1; padding: 6px; border-radius: 6px; border: 1px solid #d9d9d9; background: #fff; cursor: pointer; font: inherit; }
  footer button:disabled { color: #bfbfbf; cursor: default; }
`;

const HOST_ATTR = "data-resume-speedrun-ui";

export function removeReviewPanel() {
  document.querySelectorAll(`[${HOST_ATTR}="review"]`).forEach((el) => el.remove());
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const UNDO_STATUS_TEXT = { restored: "已还原", unchanged: "已还原", failed: "没还原" };

function renderItem(result, onLocate, { undo = false } = {}) {
  const statusText = (undo ? UNDO_STATUS_TEXT : STATUS_TEXT)[result.status];
  const detail = result.reason || result.filledText || "";
  const title = el("div", { class: "title", text: itemTitle(result) });
  if (result.required) title.append(el("span", { class: "required", text: "必填" }));
  const li = el(
    "li",
    { class: `status-${result.status}`, "data-field-id": result.fieldId, "data-status": result.status },
    [
      el("span", { class: `tag ${result.status}`, text: statusText }),
      el("div", { class: "body" }, [title, detail ? el("div", { class: "detail", text: detail }) : null]),
    ]
  );
  li.addEventListener("click", () => onLocate?.(result.fieldId));
  return li;
}

/**
 * 在页面上渲染检查清单悬浮面板。
 * @param {ReviewSummary} summary
 * @param {{ onUndo?: () => Promise<any>, onLocate?: (fieldId: string) => void, footnote?: string }} [handlers]
 *   footnote：清单底部的平台提示（如 Moka 会自动保存草稿），撤销后也一直显示
 * @returns {{ showUndoResults: (results: any[], options?: { untrackedAdded?: number }) => void, root: ShadowRoot }}
 */
export function renderReviewPanel(summary, handlers = {}) {
  removeReviewPanel();
  const host = el("div", { [HOST_ATTR]: "review" });
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: STYLE }));

  const closeButton = el("button", { class: "icon-btn", title: "关闭", "data-action": "close", text: "×" });
  closeButton.addEventListener("click", () => host.remove());

  const list = el("ul", { "data-role": "items" });
  for (const result of summary.items) list.append(renderItem(result, handlers.onLocate));

  const notices = [
    el("div", {
      class: "notice",
      "data-role": "submit-notice",
      text: "插件不会替你提交。请逐项检查（尤其是黄色、红色的项），确认无误后自己点页面上的提交按钮。",
    }),
  ];
  if (summary.missingRequired.length) {
    notices.unshift(
      el("div", {
        class: "notice warn",
        "data-role": "required-warning",
        text: `有 ${summary.missingRequired.length} 个必填项没填上，已放在最上面，请手动补全。`,
      })
    );
  }

  const undoButton = el("button", { "data-action": "undo", text: "撤销本次填写" });
  undoButton.addEventListener("click", async () => {
    undoButton.disabled = true;
    undoButton.textContent = "正在撤销…";
    await handlers.onUndo?.();
  });

  const panel = el("div", { class: "panel", "data-role": "review-panel" }, [
    el("header", {}, [el("h2", { text: "简历速通 · 填写检查清单" }), closeButton]),
    el("div", { class: "counts" }, [
      el("span", { class: "chip filled", "data-count": "filled", text: `已填 ${summary.filled.length}` }),
      el("span", {
        class: "chip confirm",
        "data-count": "needs-confirmation",
        text: `需确认 ${summary.needsConfirmation.length}`,
      }),
      el("span", { class: "chip unfilled", "data-count": "skipped", text: `未填 ${summary.skipped.length}` }),
    ]),
    ...notices,
    list,
    el("footer", {}, [
      undoButton,
      handlers.footnote ? el("div", { class: "footnote", "data-role": "draft-notice", text: handlers.footnote }) : null,
    ]),
  ]);
  root.append(panel);
  document.documentElement.append(host);

  return {
    root,
    showUndoResults(undoResults, { untrackedAdded = 0 } = {}) {
      const failedItems = undoResults.filter((r) => r.status === "failed");
      const restoredCount = undoResults.filter((r) => r.status === "restored").length;
      const deletedCount = undoResults.filter((r) => r.controlType === "added-entry" && r.status === "restored").length;
      const parts = [
        failedItems.length
          ? "已撤销本次填写。下面这些项没法自动还原，请手动检查。"
          : "已撤销本次填写，所有填过的项都恢复了原样。",
      ];
      if (deletedCount) parts.push(`插件本次自动添加的 ${deletedCount} 段经历已删除。`);
      if (untrackedAdded) parts.push(`另有 ${untrackedAdded} 段自动添加的经历区块保留为空白（插件不会点删除），请手动删除。`);
      undoButton.textContent = "已撤销";
      root.querySelector(".counts").replaceChildren(
        el("span", { class: "chip filled", "data-count": "restored", text: `已还原 ${restoredCount}` }),
        el("span", { class: "chip unfilled", "data-count": "undo-failed", text: `没能还原 ${failedItems.length}` })
      );
      root.querySelectorAll(".notice").forEach((n) => n.remove());
      list.before(
        el("div", {
          class: failedItems.length ? "notice warn" : "notice",
          "data-role": "undo-notice",
          text: parts.join(""),
        })
      );
      list.replaceChildren(...failedItems.map((r) => renderItem(r, handlers.onLocate, { undo: true })));
    },
  };
}
