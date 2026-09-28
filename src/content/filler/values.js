/**
 * 按 matcher 给出的字段路径（如 "education[1].school"、"basic.birthDate"）
 * 从简历里取值，以及把取到的值转成适合填进页面的文字。
 */

import { ENGLISH_LEVEL_PROFICIENCY } from "../../shared/options-data/standard-values.js";

const ARRAY_PATH = /^(\w+)\[(\d+)\]\.(\w+)$/;

const DEGREE_RANK = ["专科", "本科", "硕士", "博士"];

const monthIndex = (date) => (date?.year ? date.year * 12 + (date.month || 0) : -1);

/** 毕业最晚的一段教育经历（在读的算最晚），同时毕业看学历高低。 */
function latestEducation(profile) {
  const entries = (profile?.education ?? []).filter((e) => e.school || e.degree || e.major);
  const endOf = (e) => (e.isCurrent ? Infinity : monthIndex(e.endDate));
  return entries.reduce((best, e) => {
    if (!best) return e;
    const diff = endOf(e) - endOf(best);
    if (diff !== 0) return diff > 0 ? e : best;
    return DEGREE_RANK.indexOf(e.degree) > DEGREE_RANK.indexOf(best.degree) ? e : best;
  }, null);
}

const englishLevelOf = (profile) => {
  const level = profile?.skills?.englishLevel;
  return level && level !== "无" ? level : "";
};

const proficiencyNote = (profile) =>
  `按英语等级 ${englishLevelOf(profile)} 推断的，请按你的实际水平确认`;

/**
 * 网站问的是"最高学历""最近毕业专业"这类汇总信息时，从简历已有的经历里现算，
 * 不在简历里重复存一份。路径写成 "derived.xxx"。
 */
const DERIVED = {
  highestDegree(profile) {
    const ranks = (profile?.education ?? []).map((e) => DEGREE_RANK.indexOf(e.degree)).filter((r) => r >= 0);
    return ranks.length ? DEGREE_RANK[Math.max(...ranks)] : "";
  },
  latestMajor: (profile) => latestEducation(profile)?.major ?? "",
  graduationDate: (profile) => latestEducation(profile)?.endDate ?? null,
  currentTitle(profile) {
    const work = profile?.workExperiences ?? [];
    const current = work.find((e) => e.isCurrent) ?? (profile?.internships ?? []).find((e) => e.isCurrent) ?? work[0];
    return current?.title ?? "";
  },
  languageAbility(profile) {
    const skills = profile?.skills ?? {};
    if (skills.languageSkills) return skills.languageSkills;
    return englishLevelOf(profile) ? `英语 ${englishLevelOf(profile)}` : "";
  },
  // 语言能力区块（语言类型 + 听说/读写能力）：信息库只有英语等级，就按英语填。
  languageType: (profile) => (englishLevelOf(profile) ? "英语" : ""),
  languageListenSpeak: (profile) => ENGLISH_LEVEL_PROFICIENCY[englishLevelOf(profile)]?.[0] ?? "",
  languageReadWrite: (profile) => ENGLISH_LEVEL_PROFICIENCY[englishLevelOf(profile)]?.[1] ?? "",
};

/** 现算出来、只是"合理猜测"的项：填上后标"需确认"，这里给出原因。 */
const DERIVED_NOTES = {
  languageListenSpeak: proficiencyNote,
  languageReadWrite: proficiencyNote,
};

/**
 * 简历里没有单独存成对象数组、但页面上是"一段一段"的：获奖经历在简历里是
 * 字符串列表，页面上每段一个"奖项名称"。按 "awards[1].name" 这样取。
 */
const VIRTUAL_ARRAYS = {
  awards: (profile) => (profile?.skills?.awards ?? []).filter(Boolean).map((name) => ({ name })),
};

/** 简历里某类经历有几段（页面段数不够时按这个补齐）。 */
export function entriesOf(profile, arrayName) {
  if (VIRTUAL_ARRAYS[arrayName]) return VIRTUAL_ARRAYS[arrayName](profile);
  return profile?.[arrayName] ?? [];
}

/**
 * @param {import('../../shared/schema/resume.js').ResumeProfile} profile
 * @param {string} path
 * @returns {{ value: any, missingEntry?: boolean, note?: string }} note：填上了也要请用户确认的原因
 */
export function resolveResumeValue(profile, path) {
  if (path.startsWith("derived.")) {
    const name = path.slice("derived.".length);
    const compute = DERIVED[name];
    const value = compute ? compute(profile) : undefined;
    const note = DERIVED_NOTES[name] && !isEmptyValue(value) ? DERIVED_NOTES[name](profile) : undefined;
    return note ? { value, note } : { value };
  }
  const match = path.match(ARRAY_PATH);
  if (match) {
    const [, arrayName, index, key] = match;
    const entry = entriesOf(profile, arrayName)[Number(index)];
    if (!entry) return { value: undefined, missingEntry: true };
    if (key === "dateRange") {
      return {
        value: { startDate: entry.startDate, endDate: entry.endDate, isCurrent: !!entry.isCurrent },
      };
    }
    return { value: entry[key] };
  }
  return { value: path.split(".").reduce((obj, key) => obj?.[key], profile) };
}

/** 字段路径的最后一段，用来查同义词表："education[0].degree" -> "degree"。 */
export function fieldNameOf(path) {
  return path.split(".").pop();
}

export function isYearMonth(value) {
  return !!value && typeof value === "object" && "year" in value && "month" in value;
}

export function isEmptyValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isYearMonth(value)) return value.year === null || value.year === undefined;
  if (typeof value === "object" && "startDate" in value) {
    return isEmptyValue(value.startDate) && isEmptyValue(value.endDate) && !value.isCurrent;
  }
  return false;
}

const pad = (n) => String(n).padStart(2, "0");

export function formatYearMonth(date) {
  if (!date?.year) return "";
  let text = String(date.year);
  if (date.month) text += `-${pad(date.month)}`;
  if (date.month && date.day) text += `-${pad(date.day)}`;
  return text;
}

/** 把简历值转成一段文字（文本框、检查清单里展示用）。 */
export function valueToText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(valueToText).join("、");
  if (isYearMonth(value)) return formatYearMonth(value);
  if (typeof value === "object" && "startDate" in value) {
    const end = value.isCurrent ? "至今" : formatYearMonth(value.endDate);
    return `${formatYearMonth(value.startDate)} ~ ${end}`;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}
