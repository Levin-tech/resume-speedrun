/**
 * 简历数据结构定义（第 0 阶段：仅定义形状，不含真实校验/迁移逻辑）。
 *
 * 约定：
 * - 日期一律存 { year: number|null, month: number|null }，不存字符串日期，
 *   由 filler 在填写时按目标网站的格式（"2023-09" / "2023年9月" / 拆分年月下拉）现场转换。
 * - 可枚举的字段（学历、政治面貌、院校类型……）存"标准值"，
 *   标准值与各网站实际选项文案的对应关系交给 src/shared/options-data/synonyms.js。
 * - 教育经历、实习经历、项目经历为数组，可有多段。
 */

/** @typedef {{ year: number|null, month: number|null }} YearMonth */

/**
 * @typedef {Object} EducationEntry
 * @property {string} school 院校名称
 * @property {'985'|'211'|'双一流'|'普通本科'|'专科'|'其他'} schoolTier 院校类型（标准值）
 * @property {string} major 专业
 * @property {'专科'|'本科'|'硕士'|'博士'} degree 学历（标准值）
 * @property {'全日制'|'非全日制'} degreeMode 学历类型（标准值）
 * @property {YearMonth} startDate
 * @property {YearMonth} endDate
 * @property {boolean} isCurrent 是否为"至今"
 */

/**
 * @typedef {Object} InternshipEntry
 * @property {string} company 公司名称
 * @property {string} title 职位名称
 * @property {string} industry 所在行业（标准值）
 * @property {YearMonth} startDate
 * @property {YearMonth} endDate
 * @property {boolean} isCurrent
 * @property {string} description 工作内容
 */

/**
 * @typedef {Object} ProjectEntry
 * @property {string} name 项目名称
 * @property {string} role 担任角色
 * @property {YearMonth} startDate
 * @property {YearMonth} endDate
 * @property {boolean} isCurrent
 * @property {string} description 项目描述
 */

/**
 * @typedef {Object} ResumeProfile
 * @property {string} id 本地唯一 id（uuid）
 * @property {string} name 简历库名称（用户可维护多份，如"技术岗"/"产品岗"）
 * @property {Object} basic 基本信息
 * @property {string} basic.fullName 姓名
 * @property {'男'|'女'} basic.gender 性别（标准值）
 * @property {YearMonth} basic.birthDate 出生年月
 * @property {string} basic.phone 手机号
 * @property {string} basic.email 邮箱
 * @property {string} basic.nation 民族（标准值，如"汉族"）
 * @property {string} basic.politicalStatus 政治面貌（标准值，如"共青团员"）
 * @property {string} basic.nativePlace 籍贯
 * @property {string} basic.currentCity 所在城市（城市级联标准值）
 * @property {EducationEntry[]} education 教育经历（可多段）
 * @property {InternshipEntry[]} internships 实习经历（可多段）
 * @property {ProjectEntry[]} projects 项目经历（可多段）
 * @property {Object} expectation 求职意向
 * @property {string} expectation.industry 期望行业（标准值）
 * @property {string} expectation.position 期望职位
 * @property {string} expectation.city 期望城市
 * @property {number|null} expectation.salaryMin 期望薪资下限
 * @property {number|null} expectation.salaryMax 期望薪资上限
 */

/**
 * 创建一份空的简历档案，供 options 页新建时使用。
 * @param {string} id
 * @returns {ResumeProfile}
 */
export function createEmptyResumeProfile(id) {
  return {
    id,
    name: "未命名简历",
    basic: {
      fullName: "",
      gender: "",
      birthDate: { year: null, month: null },
      phone: "",
      email: "",
      nation: "",
      politicalStatus: "",
      nativePlace: "",
      currentCity: "",
    },
    education: [],
    internships: [],
    projects: [],
    expectation: {
      industry: "",
      position: "",
      city: "",
      salaryMin: null,
      salaryMax: null,
    },
  };
}
