/**
 * 信息库编辑页脚本。第 0 阶段只搭页面骨架，简历库表单、AI Key 设置、
 * 投递记录导出留到后续阶段实现。
 */

import { getResumeProfiles, getAiSettings } from "../shared/storage/storage.js";

async function init() {
  const profiles = await getResumeProfiles();
  const aiSettings = await getAiSettings();
  // TODO(第 1 阶段): 渲染简历库编辑表单和 AI Key 设置表单。
  void profiles;
  void aiSettings;
}

init();
