/**
 * 内容脚本入口。
 */

import { scanFormFields, getElementDigest } from "./scanner/scanner.js";
import { matchFields } from "./matcher/matcher.js";
import { fillFields } from "./filler/filler.js";
import { summarizeFillResults, renderReviewPanel } from "./review/review.js";
import { detectAdapter } from "./adapters/index.js";

document.documentElement.setAttribute("data-resume-speedrun-injected", "true");

async function runAutoFill(profile) {
  const adapter = detectAdapter();
  const fields = scanFormFields(document);
  const matches = await matchFields(fields, {
    platform: adapter.id,
    useAi: false,
  });
  const fillResults = await fillFields(fields, matches, profile);
  const summary = summarizeFillResults(fillResults);
  renderReviewPanel(summary);
  return summary;
}

async function runScanDiagnostics() {
  const adapter = detectAdapter();
  const fields = scanFormFields(document);
  const matches = await matchFields(fields, {
    platform: adapter.id,
    useAi: false,
  });

  const diagnostics = fields.map((field) => {
    const match = matches.find((m) => m.fieldId === field.id);
    return {
      id: field.id,
      controlType: field.controlType,
      label: field.label,
      sectionTitle: field.sectionTitle,
      sectionIndex: field.sectionIndex,
      required: field.required,
      options: field.options,
      placeholder: field.placeholder,
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

  const fields = scanFormFields(document);

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
    runAutoFill(message.profile).then((summary) =>
      sendResponse({ ok: true, summary })
    );
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
