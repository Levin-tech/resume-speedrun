/**
 * 弹窗脚本。
 *
 * 第 1 阶段实现："打开信息库"按钮 + 非自动注入网站的"在本页启用"按钮
 * （用 activeTab + chrome.scripting 按需注入 content script，不需要
 * 声明 <all_urls> host_permissions）。选择简历库/开始填写等交互留到
 * 后续阶段。
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

async function init() {
  const profiles = await getResumeProfiles();
  const activeId = await getActiveProfileId();
  // TODO(第 2 阶段): 渲染简历库下拉、启用"开始填写"按钮、绑定点击事件
  // 向当前标签页的 content script 发送 resume-speedrun:start-autofill 消息。
  void profiles;
  void activeId;

  const enableBtn = document.getElementById("enable-btn");
  const statusText = document.getElementById("status-text");
  const openOptionsBtn = document.getElementById("open-options-btn");

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
    return;
  }

  const injected = await isContentScriptInjected(tab.id);
  if (injected) {
    statusText.textContent = "本页已启用";
    return;
  }

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

init();
