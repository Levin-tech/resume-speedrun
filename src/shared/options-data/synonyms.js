/**
 * 同义词表：标准值 <-> 各网站页面上实际出现的文案。
 *
 * matcher 识别出页面上的选项文案后，通过这里反查对应哪个标准值；
 * filler 要在页面上选中某个标准值时，也通过这里正向查出该网站的写法。
 *
 * 第 0/1 阶段仅占位结构和常见示例，真实词表在适配具体网站时逐步补充。
 *
 * @typedef {Record<string, string[]>} SynonymMap 标准值 -> 该字段下各种可能出现的同义写法
 */

/** @type {SynonymMap} */
export const politicalStatusSynonyms = {
  共青团员: ["共青团员", "团员", "共青团"],
  中共党员: ["中共党员", "党员", "中共正式党员"],
  中共预备党员: ["中共预备党员", "预备党员"],
  民革党员: ["民革党员", "民革", "中国国民党革命委员会"],
  民盟盟员: ["民盟盟员", "民盟", "中国民主同盟"],
  民建会员: ["民建会员", "民建", "中国民主建国会"],
  民进会员: ["民进会员", "民进", "中国民主促进会"],
  农工党党员: ["农工党党员", "农工党", "中国农工民主党"],
  致公党党员: ["致公党党员", "致公党", "中国致公党"],
  九三学社社员: ["九三学社社员", "九三学社"],
  台盟盟员: ["台盟盟员", "台盟", "台湾民主自治同盟"],
  无党派人士: ["无党派人士", "无党派"],
  群众: ["群众"],
  民主党派: ["民主党派", "民主党派人士"],
};

/** @type {SynonymMap} */
export const workYearsSynonyms = {
  应届生: ["应届生", "应届毕业生", "在校生/应届生", "无工作经验", "无经验"],
  "1年以下": ["1年以下", "一年以下", "1年以内"],
  "1-3年": ["1-3年", "1~3年", "1至3年"],
  "3-5年": ["3-5年", "3~5年", "3至5年"],
  "5-10年": ["5-10年", "5~10年", "5至10年"],
  "10年以上": ["10年以上", "十年以上"],
};

/** @type {SynonymMap} */
export const industrySynonyms = {
  "互联网/IT": ["互联网/IT", "互联网", "IT/互联网", "计算机/互联网", "IT服务"],
  金融: ["金融", "金融/银行", "银行", "证券", "保险"],
  教育培训: ["教育培训", "教育", "培训"],
  生物医药: ["生物医药", "医疗健康", "医药", "生物/医药"],
  制造业: ["制造业", "制造", "智能制造"],
  咨询: ["咨询", "专业服务/咨询"],
  "房地产/建筑": ["房地产/建筑", "房地产", "建筑"],
  文化传媒: ["文化传媒", "传媒", "文化/传媒"],
  "能源/化工": ["能源/化工", "能源", "化工"],
  "政府/事业单位": ["政府/事业单位", "政府", "事业单位"],
  其他: ["其他"],
};

/** @type {SynonymMap} */
export const degreeSynonyms = {
  本科: ["本科", "学士", "本科/学士"],
  硕士: ["硕士", "研究生", "硕士研究生", "硕士/研究生"],
  博士: ["博士", "博士研究生"],
  专科: ["专科", "大专"],
};

/** @type {SynonymMap} */
export const degreeModeSynonyms = {
  全日制: ["全日制", "统招"],
  非全日制: ["非全日制", "在职", "定向"],
};

/** @type {SynonymMap} */
export const schoolTierSynonyms = {
  "985": ["985", "985高校", "985工程", "985院校"],
  "211": ["211", "211高校", "211工程", "211院校"],
  双一流: ["双一流", "双一流高校", "双一流院校"],
  普通本科: ["普通本科", "普通院校", "普通高校"],
  专科: ["专科", "大专院校"],
  其他: ["其他", "海外院校", "境外院校"],
};

/** @type {SynonymMap} */
export const genderSynonyms = {
  男: ["男", "男性", "male"],
  女: ["女", "女性", "female"],
};

/** @type {SynonymMap} */
export const idTypeSynonyms = {
  居民身份证: ["居民身份证", "身份证", "中国大陆居民身份证"],
  港澳居民来往内地通行证: ["港澳居民来往内地通行证", "回乡证", "港澳通行证"],
  台湾居民来往大陆通行证: ["台湾居民来往大陆通行证", "台胞证"],
  护照: ["护照", "护照(境外)", "护照（境外）"],
  其他: ["其他", "其它证件"],
};

/** @type {SynonymMap} */
export const englishLevelSynonyms = {
  "CET-4": ["CET-4", "四级", "英语四级", "大学英语四级"],
  "CET-6": ["CET-6", "六级", "英语六级", "大学英语六级"],
  "TEM-4": ["TEM-4", "专四", "英语专业四级"],
  "TEM-8": ["TEM-8", "专八", "英语专业八级"],
  IELTS: ["IELTS", "雅思"],
  TOEFL: ["TOEFL", "托福"],
  GRE: ["GRE"],
  无: ["无", "未考", "暂无"],
};

/** @type {SynonymMap} */
export const languageProficiencySynonyms = {
  一般: ["一般", "入门", "基础", "较弱"],
  良好: ["良好", "较好", "中等", "良"],
  熟练: ["熟练", "熟练掌握", "优秀"],
  精通: ["精通", "流利", "母语"],
};

/** @type {SynonymMap} */
export const languageTypeSynonyms = {
  英语: ["英语", "英文", "English"],
};

/** @type {SynonymMap} */
export const nationSynonyms = {
  汉族: ["汉族", "汉"],
  壮族: ["壮族", "壮"],
  满族: ["满族", "满"],
  回族: ["回族", "回"],
  苗族: ["苗族", "苗"],
  维吾尔族: ["维吾尔族", "维吾尔", "维族"],
  土家族: ["土家族", "土家"],
  彝族: ["彝族", "彝"],
  蒙古族: ["蒙古族", "蒙古"],
  藏族: ["藏族", "藏"],
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
    highestDegree: degreeSynonyms,
    workYears: workYearsSynonyms,
    currentIndustry: industrySynonyms,
    expectedIndustry: industrySynonyms,
    degreeMode: degreeModeSynonyms,
    schoolTier: schoolTierSynonyms,
    gender: genderSynonyms,
    idType: idTypeSynonyms,
    englishLevel: englishLevelSynonyms,
    nation: nationSynonyms,
    languageType: languageTypeSynonyms,
    languageListenSpeak: languageProficiencySynonyms,
    languageReadWrite: languageProficiencySynonyms,
  };
  return registry[fieldName] ?? null;
}

/**
 * 反查：给定字段名和网站上出现的实际文案，返回对应的标准值；
 * 找不到时返回 null。
 * @param {string} fieldName
 * @param {string} rawText
 * @returns {string|null}
 */
export function resolveStandardValue(fieldName, rawText) {
  const map = getSynonymMap(fieldName);
  if (!map || !rawText) return null;
  const normalized = rawText.trim();
  for (const [standardValue, variants] of Object.entries(map)) {
    if (variants.some((v) => v === normalized)) {
      return standardValue;
    }
  }
  return null;
}
