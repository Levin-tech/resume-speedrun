/**
 * 识别器：把 scanner 输出的 FormField 对应到简历标准字段上。
 *
 * 识别优先级（从高到低）：
 *   1. 平台适配器规则（精确选择器/文案）
 *   2. 通用关键词规则（标签文本关键词匹配）
 *   3. 都没把握、且用户配置了 AI Key 时，调用 AI 判断（只发字段标签文本）
 */

/**
 * @typedef {Object} MatchResult
 * @property {string} fieldId 对应 FormField.id
 * @property {string|null} resumeField 简历标准字段路径，如 "basic.politicalStatus"
 * @property {'adapter'|'keyword'|'ai'|'none'} matchedBy 命中方式
 * @property {number} confidence 0~1 置信度
 */

/**
 * @param {import('../scanner/scanner.js').FormField[]} fields
 * @param {{ platform: string, useAi: boolean }} context
 * @returns {Promise<MatchResult[]>}
 */
export async function matchFields(fields, context) {
  const results = [];

  for (const field of fields) {
    let result = tryKeywordMatch(field);
    if (!result) {
      result = {
        fieldId: field.id,
        resumeField: null,
        matchedBy: "none",
        confidence: 0,
      };
    }
    results.push(result);
  }

  return results;
}

/**
 * 通用关键词规则表。每条规则：
 * - keywords: 匹配关键词（标签包含任一即命中）
 * - excludeKeywords: 排除词（标签包含任一则跳过）
 * - field: 简历字段路径（不含数组索引，由 section 决定）
 * - section: 该字段属于哪个区块（null 表示不在重复区块内）
 * - isArrayField: 是否属于可重复经历的子字段
 */
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
  { keywords: ["现居", "居住城市", "现居城市", "现居地", "目前所在"], excludeKeywords: [], field: "basic.currentCity", section: null },
  { keywords: ["国家", "国籍"], excludeKeywords: [], field: "basic.country", section: null },
  { keywords: ["证件类型"], excludeKeywords: [], field: "basic.idType", section: null },
  { keywords: ["证件号", "身份证号", "身份证"], excludeKeywords: ["类型"], field: "basic.idNumber", section: null },

  // 求职意向
  { keywords: ["期望岗位", "意向岗位", "意向职位", "期望职位"], excludeKeywords: [], field: "expectation.position", section: null },
  { keywords: ["期望城市", "期望工作城市", "意向城市"], excludeKeywords: [], field: "expectation.cities", section: null },
  { keywords: ["所在行业", "目前行业", "当前行业"], excludeKeywords: [], field: "expectation.currentIndustry", section: null },
  { keywords: ["期望行业", "意向行业"], excludeKeywords: [], field: "expectation.expectedIndustry", section: null },
  { keywords: ["到岗时间", "入职时间", "最早到岗"], excludeKeywords: [], field: "expectation.availableDate", section: null },

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

  // 实习/工作经历
  { keywords: ["公司", "公司名称", "企业名称", "单位名称"], excludeKeywords: ["学校"], field: "company", section: "internship", isArrayField: true },
  { keywords: ["职位", "职位名称", "岗位名称"], excludeKeywords: ["期望"], field: "title", section: "internship", isArrayField: true },
  { keywords: ["部门"], excludeKeywords: [], field: "department", section: "internship", isArrayField: true },
  { keywords: ["工作内容", "工作描述", "职责描述"], excludeKeywords: [], field: "description", section: "internship", isArrayField: true },

  // 项目经历
  { keywords: ["项目名称", "项目名"], excludeKeywords: [], field: "name", section: "project", isArrayField: true },
  { keywords: ["担任角色", "项目角色", "角色"], excludeKeywords: [], field: "role", section: "project", isArrayField: true },
  { keywords: ["项目描述", "项目内容"], excludeKeywords: [], field: "description", section: "project", isArrayField: true },

  // 技能与其他
  { keywords: ["英语", "英语等级", "外语等级"], excludeKeywords: [], field: "skills.englishLevel", section: null },
  { keywords: ["专业技能", "技能"], excludeKeywords: ["英语"], field: "skills.skills", section: null },
  { keywords: ["自我评价", "自我介绍", "个人总结"], excludeKeywords: [], field: "skills.selfEvaluation", section: null },
];

/**
 * 日期范围的规则：起止时间关联到对应经历的 startDate/endDate。
 */
const DATE_RANGE_SECTION_RULES = [
  { section: "education", arrayName: "education" },
  { section: "internship", arrayName: "internships" },
  { section: "project", arrayName: "projects" },
];

/**
 * 用关键词规则匹配一个控件。
 * @param {import('../scanner/scanner.js').FormField} field
 * @returns {MatchResult|null}
 */
function tryKeywordMatch(field) {
  const label = field.label;
  if (!label) return null;

  // 日期范围组特殊处理
  if (field.controlType === "date-range-group") {
    return matchDateRangeGroup(field);
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
    if (rule.isArrayField) {
      if (sectionHint && sectionHint !== rule.section) {
        score *= 0.3;
      } else if (sectionHint === rule.section) {
        score *= 1.0;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (!bestMatch) return null;

  let resumeField = bestMatch.field;

  // 数组字段：加上索引
  if (bestMatch.isArrayField) {
    const arrayName = getArrayName(bestMatch.section);
    const index = field.sectionIndex || 0;
    resumeField = `${arrayName}[${index}].${bestMatch.field}`;
  }

  const confidence = bestScore >= 0.8 ? bestScore : bestScore * 0.5;

  return {
    fieldId: field.id,
    resumeField,
    matchedBy: "keyword",
    confidence,
  };
}

function matchDateRangeGroup(field) {
  const sectionHint = detectSectionFromTitle(field.sectionTitle);
  if (!sectionHint) return null;

  const arrayName = getArrayName(sectionHint);
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
 * 从区块标题推断这段经历属于哪一类。
 * @param {string} title
 * @returns {'education'|'internship'|'project'|null}
 */
export function detectSectionFromTitle(title) {
  if (!title) return null;
  if (/教育|学历|学校/.test(title)) return "education";
  if (/实习|工作|职业|就业/.test(title)) return "internship";
  if (/项目/.test(title)) return "project";
  return null;
}

function getArrayName(section) {
  const map = {
    education: "education",
    internship: "internships",
    project: "projects",
  };
  return map[section] || null;
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
      GENERIC_KEYWORD_RULES[kw] = rule.field;
    }
  }
}
