/**
 * 内容脚本入口。
 *
 * 职责：
 *   1. 响应 popup 发来的"开始填写"消息，跑一遍
 *      scanner -> matcher -> filler -> review 的流程
 *   2. 监听页面上"提交"类按钮的点击（用户自己点的，不是插件点的），
 *      点击后把当前公司/岗位/网址等信息发给 background 记一条投递记录
 *
 * 第 0 阶段：只搭好入口和消息通道，流程内部都是占位实现。
 */

import { scanFormFields } from "./scanner/scanner.js";
import { matchFields } from "./matcher/matcher.js";
import { fillFields } from "./filler/filler.js";
import { summarizeFillResults, renderReviewPanel } from "./review/review.js";
import { detectAdapter } from "./adapters/index.js";

// 供 Playwright 冒烟测试确认内容脚本已注入。
// 注意：内容脚本运行在独立的 JS 世界（isolated world），设置
// window.xxx 在页面自己的脚本/page.evaluate() 里是看不到的；
// 但 DOM 是共享的，所以用一个 data-* 属性做标记。
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "resume-speedrun:ping") {
    // 供 popup 探测当前页面是否已经注入过 content script
    // （自动注入的网站，或用户之前点过"在本页启用"）。
    sendResponse({ ok: true });
    return undefined;
  }
  if (message?.type === "resume-speedrun:start-autofill") {
    runAutoFill(message.profile).then((summary) =>
      sendResponse({ ok: true, summary })
    );
    return true; // 异步响应
  }
  return undefined;
});
