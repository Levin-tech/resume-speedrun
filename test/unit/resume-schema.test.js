import { describe, it, expect } from "vitest";
import {
  createEmptyResumeProfile,
  migrateResumeProfile,
  parseImportedProfiles,
  buildExportPayload,
  CURRENT_SCHEMA_VERSION,
} from "../../src/shared/schema/resume.js";

describe("createEmptyResumeProfile", () => {
  it("默认值形状完整，日期字段都是 { year, month }", () => {
    const profile = createEmptyResumeProfile("id-1");
    expect(profile.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(profile.basic.birthDate).toEqual({ year: null, month: null, day: null });
    expect(profile.expectation.availableDate).toEqual({ year: null, month: null });
    expect(profile.expectation.cities).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.internships).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(profile.skills.certificates).toEqual([]);
  });
});

describe("migrateResumeProfile", () => {
  it("没有 schemaVersion 的旧数据（第 0 阶段结构）能升级到当前版本", () => {
    const old = {
      id: "old-1",
      name: "旧简历",
      basic: {
        fullName: "张三",
        gender: "男",
        birthDate: { year: 1999, month: 1 },
        politicalStatus: "共青团员",
      },
      education: [
        {
          school: "某大学",
          schoolTier: "985",
          degree: "本科",
          startDate: { year: 2017, month: 9 },
          endDate: { year: 2021, month: 6 },
        },
      ],
      expectation: {
        industry: "互联网/IT",
        city: "上海",
        position: "前端工程师",
      },
    };

    const migrated = migrateResumeProfile(old);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.basic.fullName).toBe("张三");
    expect(migrated.basic.birthDate).toEqual({ year: 1999, month: 1, day: null });
    expect(migrated.expectation.expectedIndustry).toBe("互联网/IT");
    expect(migrated.expectation.cities).toEqual(["上海"]);
    expect(migrated.education[0].school).toBe("某大学");
    expect(migrated.education[0].gpa).toBe("");
  });

  it("当前版本数据原样通过（缺字段自动补空值）", () => {
    const current = createEmptyResumeProfile("id-2");
    current.basic.fullName = "李四";
    const migrated = migrateResumeProfile(current);
    expect(migrated.basic.fullName).toBe("李四");
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("非对象输入抛出中文错误", () => {
    expect(() => migrateResumeProfile(null)).toThrow("简历数据格式不正确");
  });
});

describe("parseImportedProfiles / buildExportPayload", () => {
  it("导出再导入的数据一致", () => {
    const profile = createEmptyResumeProfile("id-3");
    profile.basic.fullName = "王五";
    profile.education.push({
      school: "测试大学",
      schoolTier: "211",
      degree: "硕士",
      degreeMode: "全日制",
      major: "计算机",
      startDate: { year: 2020, month: 9 },
      endDate: { year: 2023, month: 6 },
      isCurrent: false,
      gpa: "3.8",
      ranking: "",
      lab: "",
      advisor: "",
    });

    const payload = buildExportPayload([profile]);
    const json = JSON.stringify(payload);
    const imported = parseImportedProfiles(json);

    expect(imported).toHaveLength(1);
    expect(imported[0].basic.fullName).toBe("王五");
    expect(imported[0].education[0].school).toBe("测试大学");
  });

  it("不是 JSON 时抛出中文错误，不影响原数据", () => {
    expect(() => parseImportedProfiles("not-json")).toThrow("不是有效的 JSON 格式");
  });

  it("缺少 profiles 数组时抛出中文错误", () => {
    expect(() => parseImportedProfiles(JSON.stringify({ foo: "bar" }))).toThrow(
      "缺少 profiles 数组"
    );
  });

  it("profiles 为空数组时抛出中文错误", () => {
    expect(() => parseImportedProfiles(JSON.stringify({ profiles: [] }))).toThrow(
      "没有任何简历数据"
    );
  });

  it("单条数据格式错误时指出是第几份", () => {
    expect(() =>
      parseImportedProfiles(JSON.stringify({ profiles: [null] }))
    ).toThrow("第 1 份简历数据格式不正确");
  });
});
