/**
 * 按 matcher 给出的字段路径（如 "education[1].school"、"basic.birthDate"）
 * 从简历里取值，以及把取到的值转成适合填进页面的文字。
 */

const ARRAY_PATH = /^(\w+)\[(\d+)\]\.(\w+)$/;

/**
 * @param {import('../../shared/schema/resume.js').ResumeProfile} profile
 * @param {string} path
 * @returns {{ value: any, missingEntry?: boolean }}
 */
export function resolveResumeValue(profile, path) {
  const match = path.match(ARRAY_PATH);
  if (match) {
    const [, arrayName, index, key] = match;
    const entry = profile?.[arrayName]?.[Number(index)];
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
