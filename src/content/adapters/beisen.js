/**
 * 北森（beisen.com / zhiye.com）平台适配器。
 * 第 2 阶段占位：detect() 能识别，选择器留到适配时补。
 */

/** @type {import('./adapter-interface.js').PlatformAdapter} */
export const beisenAdapter = {
  id: "beisen",

  detect() {
    return /(^|\.)beisen\.com$|(^|\.)zhiye\.com$/.test(location.hostname);
  },

  getFieldSelectors() {
    return {};
  },
};
