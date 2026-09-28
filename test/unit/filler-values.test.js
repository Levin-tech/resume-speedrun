import { describe, it, expect } from "vitest";
import {
  resolveResumeValue,
  isEmptyValue,
  valueToText,
  fieldNameOf,
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
