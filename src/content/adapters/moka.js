/**
 * Moka（moka.com / mokahr.com）平台适配器。
 *
 * 第 0 阶段占位：detect() 已经能正确识别 Moka 页面，
 * 但 getFieldSelectors() 尚未填充真实选择器，留到适配 Moka 时再补充。
 */

/** @type {import('./adapter-interface.js').PlatformAdapter} */
export const mokaAdapter = {
  id: "moka",

  detect() {
    return /(^|\.)moka(hr)?\.com$/.test(location.hostname);
  },

  getFieldSelectors() {
    // TODO(适配 Moka 时补充): 例如 { "basic.politicalStatus": "..." }
    return {};
  },
};
