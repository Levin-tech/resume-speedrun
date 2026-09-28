/**
 * 飞书招聘（feishu.cn）平台适配器。
 * 第 2 阶段占位：detect() 能识别，选择器留到适配时补。
 */

/** @type {import('./adapter-interface.js').PlatformAdapter} */
export const feishuAdapter = {
  id: "feishu",

  detect() {
    return /(^|\.)feishu\.cn$|(^|\.)feishu-pre\.net$/.test(location.hostname);
  },

  getFieldSelectors() {
    return {};
  },
};
