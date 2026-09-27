/**
 * 同义词表：标准值 <-> 各网站页面上实际出现的文案。
 *
 * matcher 识别出页面上的选项文案后，通过这里反查对应哪个标准值；
 * filler 要在页面上选中某个标准值时，也通过这里正向查出该网站的写法。
 *
 * 第 0 阶段仅占位结构和一两个示例，真实词表在适配具体网站时逐步补充。
 *
 * @typedef {Record<string, string[]>} SynonymMap 标准值 -> 该字段下各种可能出现的同义写法
 */

/** @type {SynonymMap} */
export const politicalStatusSynonyms = {
  共青团员: ["共青团员", "团员", "共青团"],
  中共党员: ["中共党员", "党员", "中共正式党员"],
  中共预备党员: ["中共预备党员", "预备党员"],
  群众: ["群众", "无党派"],
  民主党派: ["民主党派"],
};

/** @type {SynonymMap} */
export const degreeSynonyms = {
  本科: ["本科", "学士", "本科/学士"],
  硕士: ["硕士", "研究生", "硕士研究生"],
  博士: ["博士", "博士研究生"],
  专科: ["专科", "大专"],
};

/** @type {SynonymMap} */
export const schoolTierSynonyms = {
  "985": ["985", "985高校", "985工程"],
  "211": ["211", "211高校", "211工程"],
  双一流: ["双一流", "双一流高校"],
  普通本科: ["普通本科", "普通院校"],
};

/**
 * 按字段名取出对应的同义词表，供 matcher/filler 统一调用。
 * @param {string} fieldName 简历标准字段名，如 "politicalStatus"
 * @returns {SynonymMap|null}
 */
export function getSynonymMap(fieldName) {
  const registry = {
    politicalStatus: politicalStatusSynonyms,
    degree: degreeSynonyms,
    schoolTier: schoolTierSynonyms,
  };
  return registry[fieldName] ?? null;
}
