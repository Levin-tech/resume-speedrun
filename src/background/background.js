/**
 * 后台 service worker。
 *
 * 职责：
 *   1. 转发/协调 popup 与 content script 之间的消息（触发填写、返回结果）
 *   2. 记录投递（appendApplicationRecord），供 popup/options 导出 Excel
 *   3. 代理 AI 判断请求：content script 只发字段标签文本过来，
 *      这里读取用户配置的 API Key/Base URL，调用兼容 OpenAI 接口的服务，
 *      绝不把简历内容发送出去
 *
 * 第 0 阶段只搭消息路由骨架。
 */

import { appendApplicationRecord, getAiSettings } from "../shared/storage/storage.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case "resume-speedrun:record-application":
      appendApplicationRecord(message.record).then(() =>
        sendResponse({ ok: true })
      );
      return true;

    case "resume-speedrun:ai-classify-field":
      classifyFieldWithAi(message.fieldLabel, message.candidateResumeFields)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    default:
      return undefined;
  }
});

/**
 * 调用用户配置的 AI 接口，判断某个表单字段标签对应简历里的哪一项。
 * 只传字段标签文本和候选字段名列表，不传简历实际内容。
 * @param {string} fieldLabel
 * @param {string[]} candidateResumeFields
 * @returns {Promise<string|null>} 命中的简历标准字段路径，或 null
 */
async function classifyFieldWithAi(fieldLabel, candidateResumeFields) {
  const settings = await getAiSettings();
  if (!settings.apiKey) {
    return null;
  }
  // TODO(第 1 阶段): 实际调用 settings.baseUrl（默认可指向 DeepSeek 或
  // 任意 OpenAI 兼容接口），发送 fieldLabel + candidateResumeFields，
  // 解析返回的字段名。
  void fieldLabel;
  void candidateResumeFields;
  return null;
}
