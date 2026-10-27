import { describe, it, expect } from "vitest";
import {
  resolveResumeValue,
  isEmptyValue,
  valueToText,
  fieldNameOf,
  entriesOf,
} from "../../src/content/filler/values.js";

const profile = {
  basic: { fullName: "张三", birthDate: { year: 2001, month: 5, day: 20 }, idNumber: "" },
  expectation: { cities: ["北京", "上海"] },
  internships: [
    {
      company: "腾讯",
      startDate: { year: 2025, month: 7 },
      endDate: { year: null, month: null },
      isCurrent: true,
    },
  ],
};

describe("resolveResumeValue", () => {
  it("普通路径和数组路径", () => {
    expect(resolveResumeValue(profile, "basic.fullName").value).toBe("张三");
    expect(resolveResumeValue(profile, "internships[0].company").value).toBe("腾讯");
  });

  it("dateRange 取出起止时间和至今", () => {
    expect(resolveResumeValue(profile, "internships[0].dateRange").value).toEqual({
      startDate: { year: 2025, month: 7 },
      endDate: { year: null, month: null },
      isCurrent: true,
    });
  });

  it("简历段数不够时标记 missingEntry", () => {
    expect(resolveResumeValue(profile, "internships[1].company")).toEqual({
      value: undefined,
      missingEntry: true,
    });
  });

  it("fieldNameOf 取最后一段", () => {
    expect(fieldNameOf("education[0].degree")).toBe("degree");
  });
});

describe("derived.* 汇总字段", () => {
  const full = {
    education: [
      { school: "甲大学", degree: "本科", major: "计算机", endDate: { year: 2023, month: 6 }, isCurrent: false },
      { school: "乙大学", degree: "硕士", major: "软件工程", endDate: { year: 2026, month: 6 }, isCurrent: false },
    ],
    workExperiences: [{ title: "工程师", isCurrent: false }],
    internships: [{ title: "实习生", isCurrent: true }],
    skills: { englishLevel: "CET-6", languageSkills: "" },
  };
  const derived = (p, name) => resolveResumeValue(p, `derived.${name}`).value;

  it("最高学历、最近毕业专业、毕业时间取自教育经历", () => {
    expect(derived(full, "highestDegree")).toBe("硕士");
    expect(derived(full, "latestMajor")).toBe("软件工程");
    expect(derived(full, "graduationDate")).toEqual({ year: 2026, month: 6 });
    const inSchool = { education: [full.education[1], { ...full.education[0], isCurrent: true }] };
    expect(derived(inSchool, "latestMajor")).toBe("计算机");
  });

  it("目前职位：优先在职的工作，其次在职的实习，再次第一段工作", () => {
    expect(derived(full, "currentTitle")).toBe("实习生");
    expect(derived({ ...full, workExperiences: [{ title: "架构师", isCurrent: true }] }, "currentTitle")).toBe("架构师");
    expect(derived({ ...full, internships: [] }, "currentTitle")).toBe("工程师");
    expect(derived({}, "currentTitle")).toBe("");
  });

  it("语言能力：有自己写的就用，没有就用英语等级", () => {
    expect(derived(full, "languageAbility")).toBe("英语 CET-6");
    expect(derived({ skills: { languageSkills: "日语 N2", englishLevel: "CET-6" } }, "languageAbility")).toBe("日语 N2");
    expect(derived({ skills: { englishLevel: "无" } }, "languageAbility")).toBe("");
  });
});

describe("isEmptyValue / valueToText", () => {
  it("空值判断", () => {
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({ year: null, month: null })).toBe(true);
    expect(isEmptyValue(resolveResumeValue(profile, "internships[0].dateRange").value)).toBe(false);
    expect(isEmptyValue("张三")).toBe(false);
  });

  it("转成展示文字", () => {
    expect(valueToText(profile.basic.birthDate)).toBe("2001-05-20");
    expect(valueToText(profile.expectation.cities)).toBe("北京、上海");
    expect(valueToText(resolveResumeValue(profile, "internships[0].dateRange").value)).toBe("2025-07 ~ 至今");
  });
});

describe("获奖列表按段取、语言能力按英语等级推断", () => {
  const withSkills = (skills) => ({ skills: { awards: [], englishLevel: "", ...skills } });

  it("获奖经历在简历里是字符串列表，页面上一段一个奖项", () => {
    const p = withSkills({ awards: ["国家奖学金", "", "ACM 银牌"] });
    expect(entriesOf(p, "awards")).toEqual([{ name: "国家奖学金" }, { name: "ACM 银牌" }]);
    expect(resolveResumeValue(p, "awards[1].name").value).toBe("ACM 银牌");
    expect(resolveResumeValue(p, "awards[2].name").missingEntry).toBe(true);
  });

  it("语言类型填英语，听说/读写按英语等级给合理选项并带“需确认”的原因", () => {
    const p = withSkills({ englishLevel: "CET-6" });
    expect(resolveResumeValue(p, "derived.languageType")).toEqual({ value: "英语" });
    const listen = resolveResumeValue(p, "derived.languageListenSpeak");
    expect(listen.value).toBe("良好");
    expect(listen.note).toMatch(/CET-6.*确认/);
    expect(resolveResumeValue(p, "derived.languageReadWrite").value).toBe("熟练");
    expect(resolveResumeValue(withSkills({ englishLevel: "TEM-8" }), "derived.languageReadWrite").value).toBe("精通");
  });

  it("没有英语等级时语言能力区块都不填", () => {
    const p = withSkills({ englishLevel: "无" });
    expect(resolveResumeValue(p, "derived.languageType").value).toBe("");
    expect(resolveResumeValue(p, "derived.languageListenSpeak")).toEqual({ value: "" });
  });
});
