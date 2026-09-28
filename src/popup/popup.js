/**
 * 弹窗脚本。
 */

import { getResumeProfiles, getActiveProfileId } from "../shared/storage/storage.js";

const PING_MESSAGE = { type: "resume-speedrun:ping" };

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function isContentScriptInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, PING_MESSAGE);
    return true;
  } catch {
    return false;
  }
}

async function enableOnCurrentTab(tab, statusText) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/content.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content/content.css"],
    });
    statusText.textContent = "已在本页启用";
    return true;
  } catch (error) {
    statusText.textContent = `启用失败：${error.message ?? error}`;
    return false;
  }
}

let lastDiagnostics = null;

async function init() {
  const profiles = await getResumeProfiles();
  const activeId = await getActiveProfileId();
  void profiles;
  void activeId;

  const enableBtn = document.getElementById("enable-btn");
  const statusText = document.getElementById("status-text");
  const openOptionsBtn = document.getElementById("open-options-btn");
  const scanDiagBtn = document.getElementById("scan-diag-btn");
  const clearDiagBtn = document.getElementById("clear-diag-btn");
  const exportDiagBtn = document.getElementById("export-diag-btn");
  const diagSummary = document.getElementById("diag-summary");

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
    scanDiagBtn.disabled = true;
    return;
  }

  const injected = await isContentScriptInjected(tab.id);
  if (injected) {
    statusText.textContent = "本页已启用";
  } else {
    enableBtn.hidden = false;
    enableBtn.addEventListener("click", async () => {
      enableBtn.disabled = true;
      const ok = await enableOnCurrentTab(tab, statusText);
      if (ok) {
        enableBtn.hidden = true;
      } else {
        enableBtn.disabled = false;
      }
    });
  }

  scanDiagBtn.addEventListener("click", async () => {
    scanDiagBtn.disabled = true;
    statusText.textContent = "扫描中…";

    // 先确保内容脚本已注入
    if (!await isContentScriptInjected(tab.id)) {
      await enableOnCurrentTab(tab, statusText);
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "resume-speedrun:scan-diagnostics",
      });
      if (response?.ok) {
        lastDiagnostics = response.diagnostics;
        const matched = response.diagnostics.fields.filter((f) => f.resumeField).length;
        const total = response.diagnostics.fieldCount;
        diagSummary.textContent = `识别到 ${total} 个控件，${matched} 个已匹配`;
        diagSummary.hidden = false;
        clearDiagBtn.hidden = false;
        exportDiagBtn.hidden = false;
        statusText.textContent = "浮层已显示在页面上";
      } else {
        statusText.textContent = "扫描失败";
      }
    } catch (error) {
      statusText.textContent = `扫描出错：${error.message ?? error}`;
    }
    scanDiagBtn.disabled = false;
  });

  clearDiagBtn.addEventListener("click", async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "resume-speedrun:clear-diagnostics" });
      clearDiagBtn.hidden = true;
      diagSummary.hidden = true;
      statusText.textContent = "浮层已清除";
    } catch {
      // ignore
    }
  });

  exportDiagBtn.addEventListener("click", () => {
    if (!lastDiagnostics) return;
    const blob = new Blob([JSON.stringify(lastDiagnostics, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    statusText.textContent = "诊断报告已导出";
  });
}

init();
