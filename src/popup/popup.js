/**
 * 弹窗脚本。第 0 阶段只搭页面骨架，交互逻辑（选择简历库、触发填写、
 * 展示投递记录）留到后续阶段实现。
 */

import { getResumeProfiles, getActiveProfileId } from "../shared/storage/storage.js";

async function init() {
  const profiles = await getResumeProfiles();
  const activeId = await getActiveProfileId();
  // TODO(第 1 阶段): 渲染简历库下拉、启用"开始填写"按钮、绑定点击事件
  // 向当前标签页的 content script 发送 resume-speedrun:start-autofill 消息。
  void profiles;
  void activeId;
}

init();
