/**
 * 通用适配器：不针对具体平台，靠 label 文本关键词识别控件，作为所有
 * 平台适配器都没命中时的兜底。也是 test/fixtures 冒烟测试用的适配器。
 *
 * 平台适配器（moka.js 等）应当导出同样形状的对象，
 * matcher 按 detect() 结果决定优先用哪个适配器。
 */

/** @type {import('./adapter-interface.js').PlatformAdapter} */
export const genericAdapter = {
  id: "generic",

  /** 通用适配器永远"检测到"，作为兜底，优先级最低。 */
  detect() {
    return true;
  },

  /** 通用适配器没有平台专属选择器，交给 scanner 的通用启发式处理。 */
  getFieldSelectors() {
    return {};
  },
};
