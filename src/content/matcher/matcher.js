/**
 * 识别器：把 scanner 输出的 FormField 对应到简历标准字段上。
 *
 * 识别优先级（从高到低）：
 *   1. 平台适配器规则（adapter.getFieldSelectors()：标签文字完全一致才算）
 *   2. 通用关键词规则（标签文本关键词匹配）
 *   3. 都没把握、且用户配置了 AI Key 时，调用 AI 判断（只发字段标签文本）
 */

/**
 * @typedef {Object} MatchResult
 * @property {string} fieldId 对应 FormField.id
 * @property {string|null} resumeField 简历标准字段路径，如 "basic.politicalStatus"
 * @property {'adapter'|'keyword'|'ai'|'none'} matchedBy 命中方式
 * @property {number} confidence 0~1 置信度
 * @property {boolean} [unavailable] 认出来了，但信息库里本来就没有这一项（如推荐码）
 */

/**
 * 区块类型 -> 简历里的经历数组。见 planSectionArrays。
 * @typedef {Record<'education'|'internship'|'work'|'project', string>} SectionArrays
 */

export const DEFAULT_SECTION_ARRAYS = {
  education: "education",
  internship: "internships",
  work: "workExperiences",
  project: "projects",
};

/**
 * @param {import('../scanner/scanner.js').FormField[]} fields
 * @param {{ platform: string, useAi: boolean, adapterRules?: Record<string, string[]>, sectionArrays?: SectionArrays }} context
 * @returns {Promise<MatchResult[]>}
 */
export async function matchFields(fields, context) {
  const sectionArrays = context?.sectionArrays ?? DEFAULT_SECTION_ARRAYS;
  const adapterRules = context?.adapterRules ?? {};
  const results = [];

  for (const field of fields) {
    const result = tryAdapterMatch(field, adapterRules) ??
      tryUnavailableMatch(field) ??
      tryKeywordMatch(field, sectionArrays) ?? {
        fieldId: field.id,
        resumeField: null,
        matchedBy: "none",
        confidence: 0,
      };
    results.push(result);
  }

  return results;
}

/**
 * 按页面上出现了哪些区块、简历里有哪些经历，决定每类区块用简历里的哪个数组。
 * 旧版本简历把实习和工作存在同一个数组里：页面只有"工作经历"没有"实习经历"、
 * 简历里又没单独填工作经历时，工作经历区块用实习经历来填。
 * @param {string[]} sectionTitles 页面上各区块的标题
 * @param {import('../../shared/schema/resume.js').ResumeProfile|null} profile
 * @returns {SectionArrays}
 */
export function planSectionArrays(sectionTitles, profile) {
  const kinds = new Set(sectionTitles.map(detectSectionFromTitle).filter(Boolean));
  const workFromInternships =
    kinds.has("work") &&
    !kinds.has("internship") &&
    !profile?.workExperiences?.length &&
    profile?.internships?.length > 0;
  return { ...DEFAULT_SECTION_ARRAYS, work: workFromInternships ? "internships" : "workExperiences" };
}

const normalizeLabel = (label) => String(label ?? "").replace(/[\s*＊:：]/g, "");

/** 平台适配器给的规则：标签文字完全一致才算，只用于不在经历区块里的字段。 */
function tryAdapterMatch(field, adapterRules) {
  if (field.container) return null;
  const label = normalizeLabel(field.label);
  if (!label) return null;
  for (const [resumeField, labels] of Object.entries(adapterRules)) {
    if (labels.some((l) => normalizeLabel(l) === label)) {
      return { fieldId: field.id, resumeField, matchedBy: "adapter", confidence: 1 };
    }
  }
  return null;
}

/** 网申页上常见、但简历信息库里故意没有的项：直接标"信息库无此项"，不去乱猜。 */
const NO_RESUME_FIELD = ["推荐码", "内推码", "推荐人", "汇报对象", "下属人数", "离职原因", "简历更新时间"];

function tryUnavailableMatch(field) {
  const label = field.label || "";
  if (!NO_RESUME_FIELD.some((word) => label.includes(word))) return null;
  return { fieldId: field.id, resumeField: null, matchedBy: "keyword", confidence: 1, unavailable: true };
}

/**
 * 通用关键词规则表。每条规则：
 * - keywords: 匹配关键词（标签包含任一即命中）
 * - excludeKeywords: 排除词（标签包含任一则跳过）
 * - field: 简历字段路径（数组字段不含数组名和索引，由区块决定）
 * - section: 数组字段属于哪类区块，可以是多个（如公司名称：实习、工作都有）
 * - isArrayField: 是否属于可重复经历的子字段
 * - sectionOnly: 数组字段只在对应区块里才算（区块外的同名标签交给别的规则）
 * - topLevelOnly: 只在经历区块外才算（如个人信息里的"毕业时间"）
 */
const WORK_SECTIONS = ["internship", "work"];

const KEYWORD_RULES = [
  // 基本信息
  { keywords: ["姓名", "名字", "真实姓名"], excludeKeywords: ["公司", "项目", "学校"], field: "basic.fullName", section: null },
  { keywords: ["性别"], excludeKeywords: [], field: "basic.gender", section: null },
  { keywords: ["手机", "手机号", "电话号码", "联系电话"], excludeKeywords: [], field: "basic.phone", section: null },
  { keywords: ["邮箱", "电子邮箱", "电子邮件", "E-mail", "Email"], excludeKeywords: [], field: "basic.email", section: null },
  { keywords: ["出生日期", "出生年月", "生日"], excludeKeywords: [], field: "basic.birthDate", section: null },
  { keywords: ["民族"], excludeKeywords: [], field: "basic.nation", section: null },
  { keywords: ["政治面貌"], excludeKeywords: [], field: "basic.politicalStatus", section: null },
  { keywords: ["籍贯"], excludeKeywords: [], field: "basic.nativePlace", section: null },
  { keywords: ["现居", "居住城市", "现居城市", "现居地", "目前所在", "现居住地", "当前所在城市"], excludeKeywords: [], field: "basic.currentCity", section: null },
  { keywords: ["国家", "国籍"], excludeKeywords: [], field: "basic.country", section: null },
  { keywords: ["证件类型"], excludeKeywords: [], field: "basic.idType", section: null },
  { keywords: ["证件号", "身份证号", "身份证"], excludeKeywords: ["类型"], field: "basic.idNumber", section: null },
  { keywords: ["工作年限", "工作经验年限"], excludeKeywords: [], field: "basic.workYears", section: null },

  // 从教育/工作经历汇总出来的项
  { keywords: ["最高学历"], excludeKeywords: [], field: "derived.highestDegree", section: null },
  { keywords: ["最近毕业专业", "最近专业"], excludeKeywords: [], field: "derived.latestMajor", section: null },
  { keywords: ["毕业时间", "毕业年月", "毕业日期"], excludeKeywords: [], field: "derived.graduationDate", section: null, topLevelOnly: true },
  { keywords: ["目前职位", "当前职位", "现任职位"], excludeKeywords: [], field: "derived.currentTitle", section: null },
  { keywords: ["语言能力", "外语能力", "语言水平"], excludeKeywords: [], field: "derived.languageAbility", section: null },

  // 求职意向
  { keywords: ["期望岗位", "意向岗位", "意向职位", "期望职位"], excludeKeywords: [], field: "expectation.position", section: null },
  { keywords: ["期望城市", "期望工作城市", "意向城市", "意向工作城市", "工作城市"], excludeKeywords: [], field: "expectation.cities", section: null },
  { keywords: ["所在行业", "目前行业", "当前行业"], excludeKeywords: [], field: "expectation.currentIndustry", section: null },
  { keywords: ["期望行业", "意向行业"], excludeKeywords: [], field: "expectation.expectedIndustry", section: null },
  { keywords: ["到岗时间", "入职时间", "最早到岗"], excludeKeywords: [], field: "expectation.availableDate", section: null },
  { keywords: ["当前薪资", "目前薪资", "当前年薪", "目前年薪", "当前月薪", "目前月薪"], excludeKeywords: [], field: "expectation.currentSalary", section: null },
  { keywords: ["期望薪资", "期望月薪", "期望年薪", "薪资要求", "期望薪酬"], excludeKeywords: [], field: "expectation.expectedSalary", section: null },

  // 教育经历
  { keywords: ["学校", "院校", "毕业院校"], excludeKeywords: ["公司"], field: "school", section: "education", isArrayField: true },
  { keywords: ["院校类型", "学校类型", "院校层次"], excludeKeywords: [], field: "schoolTier", section: "education", isArrayField: true },
  { keywords: ["学历", "最高学历", "学位"], excludeKeywords: ["类型"], field: "degree", section: "education", isArrayField: true },
  { keywords: ["学历类型", "全日制"], excludeKeywords: [], field: "degreeMode", section: "education", isArrayField: true },
  { keywords: ["专业"], excludeKeywords: ["技能"], field: "major", section: "education", isArrayField: true },
  { keywords: ["GPA", "绩点", "成绩"], excludeKeywords: [], field: "gpa", section: "education", isArrayField: true },
  { keywords: ["排名", "年级排名"], excludeKeywords: [], field: "ranking", section: "education", isArrayField: true },
  { keywords: ["实验室", "课题组"], excludeKeywords: [], field: "lab", section: "education", isArrayField: true },
  { keywords: ["导师", "指导教师"], excludeKeywords: [], field: "advisor", section: "education", isArrayField: true },
  { keywords: ["毕业时间", "毕业年月", "毕业日期"], excludeKeywords: [], field: "endDate", section: "education", isArrayField: true, sectionOnly: true },

  // 实习/工作经历
  { keywords: ["公司", "公司名称", "企业名称", "单位名称"], excludeKeywords: ["学校"], field: "company", section: WORK_SECTIONS, isArrayField: true },
  { keywords: ["职位", "职位名称", "岗位名称"], excludeKeywords: ["期望"], field: "title", section: WORK_SECTIONS, isArrayField: true },
  { keywords: ["部门"], excludeKeywords: [], field: "department", section: WORK_SECTIONS, isArrayField: true },
  { keywords: ["工作内容", "工作描述", "职责描述", "实习描述", "实习内容"], excludeKeywords: [], field: "description", section: WORK_SECTIONS, isArrayField: true },

  // 项目经历
  { keywords: ["项目名称", "项目名"], excludeKeywords: [], field: "name", section: "project", isArrayField: true },
  { keywords: ["担任角色", "项目角色", "角色"], excludeKeywords: [], field: "role", section: "project", isArrayField: true },
  { keywords: ["项目描述", "项目内容"], excludeKeywords: [], field: "description", section: "project", isArrayField: true },

  // 技能与其他
  { keywords: ["英语", "英语等级", "外语等级"], excludeKeywords: [], field: "skills.englishLevel", section: null },
  { keywords: ["专业技能", "技能"], excludeKeywords: ["英语"], field: "skills.skills", section: null },
  { keywords: ["获奖经历", "获奖情况", "获奖", "荣誉奖项"], excludeKeywords: [], field: "skills.awards", section: null },
  { keywords: ["兴趣爱好", "爱好", "特长爱好"], excludeKeywords: [], field: "skills.hobbies", section: null },
  { keywords: ["自我评价", "自我介绍", "个人总结", "自我描述"], excludeKeywords: [], field: "skills.selfEvaluation", section: null },
];

/**
 * 用关键词规则匹配一个控件。
 * @param {import('../scanner/scanner.js').FormField} field
 * @param {SectionArrays} sectionArrays
 * @returns {MatchResult|null}
 */
function tryKeywordMatch(field, sectionArrays = DEFAULT_SECTION_ARRAYS) {
  const label = field.label;
  if (!label) return null;

  // 日期范围组特殊处理
  if (field.controlType === "date-range-group") {
    return matchDateRangeGroup(field, sectionArrays);
  }

  // 根据区块标题判断字段属于哪类经历
  const sectionHint = detectSectionFromTitle(field.sectionTitle);

  let bestMatch = null;
  let bestScore = 0;

  for (const rule of KEYWORD_RULES) {
    // 排除词检查
    if (rule.excludeKeywords.length > 0) {
      const excluded = rule.excludeKeywords.some((ek) => label.includes(ek));
      if (excluded) continue;
    }
    const ruleSections = [].concat(rule.section ?? []);
    if (rule.topLevelOnly && sectionHint) continue;
    if (rule.sectionOnly && !ruleSections.includes(sectionHint)) continue;

    // 关键词匹配评分
    let score = 0;
    for (const kw of rule.keywords) {
      if (label === kw) {
        score = 1.0;
        break;
      }
      if (label.includes(kw)) {
        score = Math.max(score, 0.8);
      }
    }

    if (score === 0) continue;

    // 如果是数组字段，需要区块标题匹配
    if (rule.isArrayField && sectionHint && !ruleSections.includes(sectionHint)) {
      score *= 0.3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (!bestMatch) return null;

  let resumeField = bestMatch.field;

  // 数组字段：加上数组名和索引
  if (bestMatch.isArrayField) {
    const ruleSections = [].concat(bestMatch.section);
    const section = ruleSections.includes(sectionHint) ? sectionHint : ruleSections[0];
    const index = field.sectionIndex || 0;
    resumeField = `${sectionArrays[section]}[${index}].${bestMatch.field}`;
  }

  const confidence = bestScore >= 0.8 ? bestScore : bestScore * 0.5;

  return {
    fieldId: field.id,
    resumeField,
    matchedBy: "keyword",
    confidence,
  };
}

function matchDateRangeGroup(field, sectionArrays) {
  const sectionHint = detectSectionFromTitle(field.sectionTitle);
  if (!sectionHint) return null;

  const arrayName = sectionArrays[sectionHint];
  if (!arrayName) return null;

  const index = field.sectionIndex || 0;

  return {
    fieldId: field.id,
    resumeField: `${arrayName}[${index}].dateRange`,
    matchedBy: "keyword",
    confidence: 0.9,
  };
}

/**
 * 从区块标题推断这段经历属于哪一类。"实习/工作经历"这种混写的算实习。
 * @param {string} title
 * @returns {'education'|'internship'|'work'|'project'|null}
 */
export function detectSectionFromTitle(title) {
  if (!title) return null;
  if (/教育|学历|学校/.test(title)) return "education";
  if (/实习/.test(title)) return "internship";
  if (/工作|职业|就业/.test(title)) return "work";
  if (/项目/.test(title)) return "project";
  return null;
}

/**
 * 计算标签文本与关键词的匹配得分，供外部单元测试使用。
 * @param {string} label
 * @param {string} keyword
 * @returns {number}
 */
export function computeLabelScore(label, keyword) {
  if (!label || !keyword) return 0;
  if (label === keyword) return 1.0;
  if (label.includes(keyword)) return 0.8;
  return 0;
}

/**
 * 兼容旧的 GENERIC_KEYWORD_RULES 接口（给已有测试用）。
 */
export const GENERIC_KEYWORD_RULES = {};
for (const rule of KEYWORD_RULES) {
  if (!rule.isArrayField) {
    for (const kw of rule.keywords) {
      GENERIC_KEYWORD_RULES[kw] ??= rule.field;
    }
  }
}
