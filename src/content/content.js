/**
 * 内容脚本入口。
 */

import { scanFormFields, getElementDigest } from "./scanner/scanner.js";
import { matchFields, planSectionArrays, detectSectionFromTitle } from "./matcher/matcher.js";
import { fillFields, expandRepeatableSections, undoFill, rememberPluginValues } from "./filler/filler.js";
import { summarizeFillResults, renderReviewPanel, removeReviewPanel } from "./review/review.js";
import { detectAdapter } from "./adapters/index.js";
import { migrateResumeProfile } from "../shared/schema/resume.js";

document.documentElement.setAttribute("data-resume-speedrun-injected", "true");

/** 平台上值得在清单底部提醒用户的事。 */
const PLATFORM_NOTES = {
  moka: "Moka 会自动保存草稿，撤销后如仍有残留可刷新页面检查",
};

/** 最近一次填写：撤销记录、插件添加的经历段、控件引用（点清单条目时滚动过去用）、清单面板。 */
let lastFill = null;
let busy = false;

/**
 * 扫描 + 识别。profile 用来决定经历区块对应简历里的哪个数组（见 planSectionArrays），
 * 做诊断时没有简历，传 null。
 */
async function scanAndMatch(profile) {
  const adapter = detectAdapter();
  const fields = scanFormFields(document, { adapter });
  // 适配器没扫到、退回了通用扫描时，经历区块也按通用方式从扫描结果推断。
  const fromAdapter = fields.some((f) => f.kit);
  const repeatable = fromAdapter ? (adapter.getRepeatableSections?.(document) ?? null) : null;
  const sectionArrays = planSectionArrays(
    [...fields.map((f) => f.sectionTitle), ...(repeatable ?? []).map((s) => s.title)],
    profile
  );
  const matches = await matchFields(fields, {
    platform: adapter.id,
    adapterRules: adapter.getFieldSelectors(),
    sectionArrays,
    useAi: false,
  });
  const sections = repeatable?.map((s) => ({ ...s, arrayName: sectionArrays[detectSectionFromTitle(s.title)] }));
  return { adapter, fields, matches, sections: sections ?? null, platform: adapter.id };
}

function locateField(fieldId) {
  const element = lastFill?.elements.get(fieldId);
  if (!element?.isConnected) return;
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.classList.add("resume-speedrun-highlight");
  setTimeout(() => element.classList.remove("resume-speedrun-highlight"), 2000);
}

/** 只把数量和每项状态回给弹窗，不带控件引用，也不带填进去的具体内容。 */
function toPopupSummary(summary) {
  return {
    filled: summary.filled.length,
    needsConfirmation: summary.needsConfirmation.length,
    skipped: summary.skipped.length,
    missingRequired: summary.missingRequired.length,
  };
}

async function runAutoFill(rawProfile) {
  if (busy) return { ok: false, error: "正在处理上一次操作，请稍候" };
  busy = true;
  try {
    const profile = migrateResumeProfile(rawProfile);
    removeReviewPanel();

    let { fields, matches, sections, platform } = await scanAndMatch(profile);
    // 简历经历段数比页面多时，先点"添加"补齐区块，再重新扫描匹配。
    const expansion = await expandRepeatableSections(fields, matches, profile, sections);
    if (expansion.added > 0) ({ fields, matches } = await scanAndMatch(profile));

    const journal = [];
    const results = await fillFields(fields, matches, profile, { journal });
    results.push(...expansion.results);
    rememberPluginValues(expansion.addedEntries);

    const summary = summarizeFillResults(results);
    lastFill = {
      journal,
      addedEntries: expansion.addedEntries,
      // 没法记下是哪一段的（通用页面），撤销时只能留成空白。
      untrackedAdded: expansion.added - expansion.addedEntries.length,
      elements: new Map(fields.map((f) => [f.id, f.element])),
      panel: null,
    };
    lastFill.panel = renderReviewPanel(summary, {
      onUndo: runUndo,
      onLocate: locateField,
      footnote: PLATFORM_NOTES[platform] ?? "",
    });
    return { ok: true, summary: toPopupSummary(summary) };
  } finally {
    busy = false;
  }
}

async function runUndo() {
  if (!lastFill) return { ok: false, error: "这个页面还没有填写过" };
  if (busy) return { ok: false, error: "正在处理上一次操作，请稍候" };
  busy = true;
  try {
    const results = await undoFill(lastFill.journal, lastFill.addedEntries);
    lastFill.panel?.showUndoResults(results, { untrackedAdded: lastFill.untrackedAdded });
    lastFill.journal = [];
    lastFill.addedEntries = [];
    lastFill.untrackedAdded = 0;
    return {
      ok: true,
      restored: results.filter((r) => r.status === "restored").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
  } finally {
    busy = false;
  }
}

async function runScanDiagnostics() {
  const { adapter, fields, matches } = await scanAndMatch(null);

  const diagnostics = fields.map((field) => {
    const match = matches.find((m) => m.fieldId === field.id);
    return {
      id: field.id,
      controlType: field.controlType,
      kit: field.kit || null,
      skipReason: field.skipReason || null,
      unavailable: !!match?.unavailable,
      label: field.label,
      sectionTitle: field.sectionTitle,
      sectionIndex: field.sectionIndex,
      required: field.required,
      options: field.options,
      placeholder: field.placeholder,
      parts: field.subElements
        ? Object.fromEntries(Object.entries(field.subElements).map(([k, v]) => [k, !!v]))
        : null,
      resumeField: match?.resumeField || null,
      matchedBy: match?.matchedBy || "none",
      confidence: match?.confidence || 0,
      element: getElementDigest(field.element),
    };
  });

  return { platform: adapter.id, fieldCount: fields.length, fields: diagnostics };
}

function renderDiagnosticOverlays(diagnostics) {
  removeDiagnosticOverlays();

  const fields = scanFormFields(document, { adapter: detectAdapter() });

  for (const field of fields) {
    const diag = diagnostics.fields.find((d) => d.id === field.id);
    if (!diag) continue;

    const overlay = document.createElement("div");
    overlay.className = "resume-speedrun-diagnostic-overlay";
    overlay.setAttribute("data-diagnostic-id", field.id);

    const confidenceClass =
      diag.confidence >= 0.8 ? "high" : diag.confidence >= 0.5 ? "medium" : "low";

    overlay.innerHTML = `
      <div class="diag-label">
        <span class="diag-type">${diag.controlType}</span>
        <span class="diag-text">${diag.label || "(无标签)"}</span>
        ${diag.resumeField ? `<span class="diag-field diag-${confidenceClass}">${diag.resumeField}</span>` : '<span class="diag-field diag-none">未匹配</span>'}
        ${diag.confidence > 0 ? `<span class="diag-confidence">${Math.round(diag.confidence * 100)}%</span>` : ""}
      </div>
    `;

    const el = field.element;
    const rect = el.getBoundingClientRect();
    overlay.style.position = "absolute";
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY - 24}px`;
    overlay.style.zIndex = "999999";

    document.body.appendChild(overlay);
  }
}

function removeDiagnosticOverlays() {
  const existing = document.querySelectorAll(".resume-speedrun-diagnostic-overlay");
  for (const el of existing) el.remove();
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "resume-speedrun:scan-diagnostics-request") {
    runScanDiagnostics().then((diagnostics) => {
      window.postMessage(
        { type: "resume-speedrun:scan-diagnostics-response", payload: { ok: true, diagnostics } },
        "*"
      );
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "resume-speedrun:ping") {
    sendResponse({ ok: true });
    return undefined;
  }
  if (message?.type === "resume-speedrun:start-autofill") {
    runAutoFill(message.profile)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }
  if (message?.type === "resume-speedrun:undo-fill") {
    runUndo()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }
  if (message?.type === "resume-speedrun:scan-diagnostics") {
    runScanDiagnostics().then((diagnostics) => {
      renderDiagnosticOverlays(diagnostics);
      sendResponse({ ok: true, diagnostics });
    });
    return true;
  }
  if (message?.type === "resume-speedrun:clear-diagnostics") {
    removeDiagnosticOverlays();
    sendResponse({ ok: true });
    return undefined;
  }
  return undefined;
});
