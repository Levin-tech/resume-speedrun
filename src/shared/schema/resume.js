/**
 * 简历数据结构定义（第 1 阶段：完整字段 + 版本迁移）。
 *
 * 约定：
 * - 日期一律存 { year: number|null, month: number|null }，不存字符串日期，
 *   出生日期额外带 day；由 filler 在填写时按目标网站的格式现场转换。
 * - 可枚举的字段（学历、政治面貌、院校类型……）存"标准值"，
 *   标准值与各网站实际选项文案的对应关系交给 src/shared/options-data/synonyms.js。
 * - 教育经历、实习经历、项目经历为数组，可有多段。
 * - 数据带 schemaVersion，升级结构时在 migrateResumeProfile 里加迁移步骤，
 *   不直接改旧数据的含义。
 */

/** 当前最新的数据结构版本号。 */
export const CURRENT_SCHEMA_VERSION = 2;

/** @typedef {{ year: number|null, month: number|null }} YearMonth */
/** @typedef {{ year: number|null, month: number|null, day: number|null }} FullDate */

/**
 * @typedef {Object} EducationEntry
 * @property {string} school 学校
 * @property {string} schoolTier 院校类型（标准值：985/211/双一流/普通本科/专科/其他）
 * @property {string} degree 学历（标准值：专科/本科/硕士/博士）
 * @property {string} degreeMode 学历类型（标准值：全日制/非全日制）
 * @property {string} major 专业
 * @property {YearMonth} startDate
 * @property {YearMonth} endDate
 * @property {boolean} isCurrent 是否为"至今"
 * @property {string} gpa GPA / 绩点
 * @property {string} ranking 排名
 * @property {string} lab 实验室
 * @property {string} advisor 导师
 */

/**
 * @typedef {Object} InternshipEntry
 * @property {string} company 公司
 * @property {string} title 职位
 * @property {string} department 部门
 * @property {YearMonth} startDate
 * @property {YearMonth} endDate
 * @property {boolean} isCurrent 是否至今
 * @property {string} description 工作内容
 */

/**
 * 正式工作经历（版本 2 起和实习经历分开存），字段同 InternshipEntry。
 * @typedef {InternshipEntry} WorkEntry
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
 * @typedef {Object} BasicInfo
 * @property {string} fullName 姓名
 * @property {string} gender 性别（标准值）
 * @property {FullDate} birthDate 出生年月日
 * @property {string} phone 手机
 * @property {string} email 邮箱
 * @property {string} idType 证件类型（标准值）
 * @property {string} idNumber 证件号
 * @property {string} nation 民族（标准值）
 * @property {string} politicalStatus 政治面貌（标准值）
 * @property {string} nativePlace 籍贯
 * @property {string} currentCity 现居城市
 * @property {string} country 国家/地区
 * @property {string} workYears 工作经验年限（标准值）
 */

/**
 * @typedef {Object} Expectation 求职意向
 * @property {string} position 期望岗位
 * @property {string[]} cities 期望城市（多个）
 * @property {string} currentIndustry 所在行业（标准值）
 * @property {string} expectedIndustry 期望行业（标准值）
 * @property {YearMonth} availableDate 到岗时间
 * @property {string} currentSalary 当前薪资（自由文字，如"15K×14"）
 * @property {string} expectedSalary 期望薪资（自由文字，如"20-25K"）
 */

/**
 * @typedef {Object} SkillsInfo 技能与其他
 * @property {string} englishLevel 英语等级（标准值）
 * @property {string} skills 专业技能
 * @property {string[]} certificates 证书（多个）
 * @property {string[]} awards 获奖（多个）
 * @property {string} selfEvaluation 自我评价
 * @property {string} hobbies 兴趣爱好
 * @property {string} languageSkills 语言能力（自由文字，如"英语 CET-6 580；日语 N2"）
 */

/**
 * @typedef {Object} ResumeProfile
 * @property {string} id 本地唯一 id（uuid）
 * @property {number} schemaVersion 数据结构版本号
 * @property {string} name 简历库名称（用户可维护多份，如"技术岗"/"产品岗"）
 * @property {BasicInfo} basic 基本信息
 * @property {Expectation} expectation 求职意向
 * @property {EducationEntry[]} education 教育经历（可多段）
 * @property {InternshipEntry[]} internships 实习经历（可多段）
 * @property {WorkEntry[]} workExperiences 正式工作经历（可多段）
 * @property {ProjectEntry[]} projects 项目经历（可多段）
 * @property {SkillsInfo} skills 技能与其他
 */

/** @returns {YearMonth} */
function emptyYearMonth() {
  return { year: null, month: null };
}

/** @returns {FullDate} */
function emptyFullDate() {
  return { year: null, month: null, day: null };
}

/** @returns {BasicInfo} */
function emptyBasicInfo() {
  return {
    fullName: "",
    gender: "",
    birthDate: emptyFullDate(),
    phone: "",
    email: "",
    idType: "",
    idNumber: "",
    nation: "",
    politicalStatus: "",
    nativePlace: "",
    currentCity: "",
    country: "",
    workYears: "",
  };
}

/** @returns {Expectation} */
function emptyExpectation() {
  return {
    position: "",
    cities: [],
    currentIndustry: "",
    expectedIndustry: "",
    availableDate: emptyYearMonth(),
    currentSalary: "",
    expectedSalary: "",
  };
}

/** @returns {SkillsInfo} */
function emptySkillsInfo() {
  return {
    englishLevel: "",
    skills: "",
    certificates: [],
    awards: [],
    selfEvaluation: "",
    hobbies: "",
    languageSkills: "",
  };
}

/** @returns {EducationEntry} */
export function createEmptyEducationEntry() {
  return {
    school: "",
    schoolTier: "",
    degree: "",
    degreeMode: "",
    major: "",
    startDate: emptyYearMonth(),
    endDate: emptyYearMonth(),
    isCurrent: false,
    gpa: "",
    ranking: "",
    lab: "",
    advisor: "",
  };
}

/** @returns {InternshipEntry} */
export function createEmptyInternshipEntry() {
  return {
    company: "",
    title: "",
    department: "",
    startDate: emptyYearMonth(),
    endDate: emptyYearMonth(),
    isCurrent: false,
    description: "",
  };
}

/** @returns {WorkEntry} */
export function createEmptyWorkEntry() {
  return createEmptyInternshipEntry();
}

/** @returns {ProjectEntry} */
export function createEmptyProjectEntry() {
  return {
    name: "",
    role: "",
    startDate: emptyYearMonth(),
    endDate: emptyYearMonth(),
    isCurrent: false,
    description: "",
  };
}

/**
 * 创建一份空的简历档案，供 options 页新建时使用。
 * @param {string} id
 * @returns {ResumeProfile}
 */
export function createEmptyResumeProfile(id) {
  return {
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: "未命名简历",
    basic: emptyBasicInfo(),
    expectation: emptyExpectation(),
    education: [],
    internships: [],
    workExperiences: [],
    projects: [],
    skills: emptySkillsInfo(),
  };
}

/**
 * 把可能是旧版本结构的数据迁移到当前版本。传入数据没有 schemaVersion
 * 一律视为版本 0（第 0 阶段的占位结构）。迁移只补字段、不改变已有数据
 * 的含义，未来加新版本时在这里继续往下接 case。
 * @param {any} data
 * @returns {ResumeProfile}
 */
export function migrateResumeProfile(data) {
  if (!data || typeof data !== "object") {
    throw new Error("简历数据格式不正确");
  }

  let profile = { ...data };
  let version = typeof profile.schemaVersion === "number" ? profile.schemaVersion : 0;

  if (version < 1) {
    profile = migrateV0ToV1(profile);
    version = 1;
  }
  if (version < 2) {
    profile = migrateV1ToV2(profile);
    version = 2;
  }

  return normalizeResumeProfile(profile);
}

/**
 * 版本 1 升级到版本 2：新增正式工作经历（workExperiences，和实习经历分开）、
 * 工作经验年限、当前/期望薪资、兴趣爱好、语言能力，全部补空值。版本 1 里
 * "实习/工作经历"是同一个数组，原样保留在 internships 里，不猜哪段是正式工作。
 * @param {any} old
 * @returns {any}
 */
function migrateV1ToV2(old) {
  return {
    ...old,
    schemaVersion: 2,
    basic: { workYears: "", ...old.basic },
    expectation: { currentSalary: "", expectedSalary: "", ...old.expectation },
    skills: { hobbies: "", languageSkills: "", ...old.skills },
    workExperiences: Array.isArray(old.workExperiences) ? old.workExperiences : [],
  };
}

/**
 * 版本 0（第 0 阶段的占位结构，字段较少且求职意向/基本信息形状不同）
 * 升级到版本 1（当前结构）。
 * @param {any} old
 * @returns {any}
 */
function migrateV0ToV1(old) {
  const oldBasic = old.basic ?? {};
  const oldExpectation = old.expectation ?? {};

  return {
    id: old.id,
    schemaVersion: 1,
    name: old.name ?? "未命名简历",
    basic: {
      fullName: oldBasic.fullName ?? "",
      gender: oldBasic.gender ?? "",
      birthDate: toFullDate(oldBasic.birthDate),
      phone: oldBasic.phone ?? "",
      email: oldBasic.email ?? "",
      idType: oldBasic.idType ?? "",
      idNumber: oldBasic.idNumber ?? "",
      nation: oldBasic.nation ?? "",
      politicalStatus: oldBasic.politicalStatus ?? "",
      nativePlace: oldBasic.nativePlace ?? "",
      currentCity: oldBasic.currentCity ?? "",
      country: oldBasic.country ?? "",
    },
    expectation: {
      position: oldExpectation.position ?? "",
      cities: oldExpectation.city ? [oldExpectation.city] : oldExpectation.cities ?? [],
      currentIndustry: oldExpectation.currentIndustry ?? "",
      expectedIndustry: oldExpectation.industry ?? oldExpectation.expectedIndustry ?? "",
      availableDate: toYearMonth(oldExpectation.availableDate),
    },
    education: (old.education ?? []).map(migrateEducationEntryV0ToV1),
    internships: (old.internships ?? []).map(migrateInternshipEntryV0ToV1),
    projects: (old.projects ?? []).map(migrateProjectEntryV0ToV1),
    skills: {
      englishLevel: old.skills?.englishLevel ?? "",
      skills: old.skills?.skills ?? "",
      certificates: old.skills?.certificates ?? [],
      awards: old.skills?.awards ?? [],
      selfEvaluation: old.skills?.selfEvaluation ?? "",
    },
  };
}

function migrateEducationEntryV0ToV1(entry) {
  const base = createEmptyEducationEntry();
  return {
    ...base,
    ...entry,
    startDate: toYearMonth(entry.startDate),
    endDate: toYearMonth(entry.endDate),
  };
}

function migrateInternshipEntryV0ToV1(entry) {
  const base = createEmptyInternshipEntry();
  return {
    ...base,
    ...entry,
    startDate: toYearMonth(entry.startDate),
    endDate: toYearMonth(entry.endDate),
  };
}

function migrateProjectEntryV0ToV1(entry) {
  const base = createEmptyProjectEntry();
  return {
    ...base,
    ...entry,
    startDate: toYearMonth(entry.startDate),
    endDate: toYearMonth(entry.endDate),
  };
}

/** @returns {YearMonth} */
function toYearMonth(value) {
  if (!value || typeof value !== "object") return emptyYearMonth();
  return { year: value.year ?? null, month: value.month ?? null };
}

/** @returns {FullDate} */
function toFullDate(value) {
  if (!value || typeof value !== "object") return emptyFullDate();
  return { year: value.year ?? null, month: value.month ?? null, day: value.day ?? null };
}

/**
 * 把任意结构补齐成完整的当前版本 ResumeProfile 形状（缺的字段用空值
 * 补上），避免局部数据（比如手写测试 fixture）在页面渲染时报错。
 * @param {any} profile
 * @returns {ResumeProfile}
 */
/**
 * 校验并解析从 JSON 文件导入的简历库数据，供 options 页导入功能使用。
 * 校验失败时抛出带中文说明的 Error，调用方应捕获后展示提示、不覆盖
 * 现有数据。
 * @param {string} jsonText
 * @returns {ResumeProfile[]}
 */
export function parseImportedProfiles(jsonText) {
  let raw;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error("文件不是有效的 JSON 格式");
  }

  const list = Array.isArray(raw) ? raw : raw?.profiles;
  if (!Array.isArray(list)) {
    throw new Error("文件内容不是简历库导出格式（缺少 profiles 数组）");
  }
  if (list.length === 0) {
    throw new Error("文件中没有任何简历数据");
  }

  return list.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`第 ${index + 1} 份简历数据格式不正确`);
    }
    try {
      return migrateResumeProfile({ ...item, id: item.id || createLocalId() });
    } catch (error) {
      throw new Error(`第 ${index + 1} 份简历数据解析失败：${error.message}`);
    }
  });
}

/**
 * 生成导出文件内容（字符串化前的对象），包含版本号和导出时间，
 * 方便以后追溯/兼容旧的导出文件。
 * @param {ResumeProfile[]} profiles
 */
export function buildExportPayload(profiles) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
  };
}

export function createLocalId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeResumeProfile(profile) {
  const empty = createEmptyResumeProfile(profile.id);
  return {
    ...empty,
    ...profile,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    basic: { ...empty.basic, ...profile.basic },
    expectation: { ...empty.expectation, ...profile.expectation },
    skills: { ...empty.skills, ...profile.skills },
    education: Array.isArray(profile.education)
      ? profile.education.map((e) => ({ ...createEmptyEducationEntry(), ...e }))
      : [],
    internships: Array.isArray(profile.internships)
      ? profile.internships.map((e) => ({ ...createEmptyInternshipEntry(), ...e }))
      : [],
    workExperiences: Array.isArray(profile.workExperiences)
      ? profile.workExperiences.map((e) => ({ ...createEmptyWorkEntry(), ...e }))
      : [],
    projects: Array.isArray(profile.projects)
      ? profile.projects.map((e) => ({ ...createEmptyProjectEntry(), ...e }))
      : [],
  };
}
