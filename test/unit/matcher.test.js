import { describe, it, expect } from "vitest";
import {
  GENERIC_KEYWORD_RULES,
  matchFields,
  computeLabelScore,
  detectSectionFromTitle,
} from "../../src/content/matcher/matcher.js";

describe("GENERIC_KEYWORD_RULES", () => {
  it("覆盖了基本信息里最常见的字段", () => {
    expect(GENERIC_KEYWORD_RULES["姓名"]).toBe("basic.fullName");
    expect(GENERIC_KEYWORD_RULES["政治面貌"]).toBe("basic.politicalStatus");
  });

  it("覆盖了手机/邮箱/性别/民族等字段", () => {
    expect(GENERIC_KEYWORD_RULES["手机"]).toBe("basic.phone");
    expect(GENERIC_KEYWORD_RULES["邮箱"]).toBe("basic.email");
    expect(GENERIC_KEYWORD_RULES["性别"]).toBe("basic.gender");
    expect(GENERIC_KEYWORD_RULES["民族"]).toBe("basic.nation");
  });

  it("覆盖了求职意向字段", () => {
    expect(GENERIC_KEYWORD_RULES["期望岗位"]).toBe("expectation.position");
    expect(GENERIC_KEYWORD_RULES["期望城市"]).toBe("expectation.cities");
  });
});

describe("computeLabelScore", () => {
  it("完全匹配返回 1.0", () => {
    expect(computeLabelScore("姓名", "姓名")).toBe(1.0);
  });

  it("包含匹配返回 0.8", () => {
    expect(computeLabelScore("您的姓名", "姓名")).toBe(0.8);
  });

  it("不匹配返回 0", () => {
    expect(computeLabelScore("学校", "姓名")).toBe(0);
  });

  it("空输入返回 0", () => {
    expect(computeLabelScore("", "姓名")).toBe(0);
    expect(computeLabelScore("姓名", "")).toBe(0);
  });
});

describe("detectSectionFromTitle", () => {
  it("识别教育经历", () => {
    expect(detectSectionFromTitle("教育经历")).toBe("education");
    expect(detectSectionFromTitle("学历信息")).toBe("education");
  });

  it("识别实习/工作经历", () => {
    expect(detectSectionFromTitle("实习经历")).toBe("internship");
    expect(detectSectionFromTitle("工作经历")).toBe("internship");
  });

  it("识别项目经历", () => {
    expect(detectSectionFromTitle("项目经历")).toBe("project");
  });

  it("未知区块返回 null", () => {
    expect(detectSectionFromTitle("基本信息")).toBeNull();
    expect(detectSectionFromTitle("")).toBeNull();
    expect(detectSectionFromTitle(null)).toBeNull();
  });
});

describe("matchFields", () => {
  it("对每个字段都返回一个 MatchResult", async () => {
    const fields = [
      { id: "f1", label: "姓名", controlType: "text", sectionTitle: "", sectionIndex: 0 },
      { id: "f2", label: "未知字段", controlType: "text", sectionTitle: "", sectionIndex: 0 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results).toHaveLength(2);
  });

  it("能匹配基本信息字段", async () => {
    const fields = [
      { id: "f1", label: "姓名", controlType: "text", sectionTitle: "基本信息", sectionIndex: 0 },
      { id: "f2", label: "政治面貌", controlType: "select", sectionTitle: "基本信息", sectionIndex: 0 },
      { id: "f3", label: "手机号", controlType: "text", sectionTitle: "基本信息", sectionIndex: 0 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results[0]).toMatchObject({ resumeField: "basic.fullName", matchedBy: "keyword" });
    expect(results[1]).toMatchObject({ resumeField: "basic.politicalStatus", matchedBy: "keyword" });
    expect(results[2]).toMatchObject({ resumeField: "basic.phone", matchedBy: "keyword" });
  });

  it("教育经历的字段能匹配到 education[N].xxx", async () => {
    const fields = [
      { id: "f1", label: "学校", controlType: "searchable-select", sectionTitle: "教育经历", sectionIndex: 0 },
      { id: "f2", label: "专业", controlType: "searchable-select", sectionTitle: "教育经历", sectionIndex: 0 },
      { id: "f3", label: "学校", controlType: "searchable-select", sectionTitle: "教育经历", sectionIndex: 1 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results[0].resumeField).toBe("education[0].school");
    expect(results[1].resumeField).toBe("education[0].major");
    expect(results[2].resumeField).toBe("education[1].school");
  });

  it("实习经历的字段能匹配到 internships[N].xxx", async () => {
    const fields = [
      { id: "f1", label: "公司名称", controlType: "text", sectionTitle: "实习经历", sectionIndex: 0 },
      { id: "f2", label: "职位名称", controlType: "text", sectionTitle: "实习经历", sectionIndex: 0 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results[0].resumeField).toBe("internships[0].company");
    expect(results[1].resumeField).toBe("internships[0].title");
  });

  it("没把握的字段标记为 none", async () => {
    const fields = [
      { id: "f1", label: "某个完全未知的字段", controlType: "text", sectionTitle: "", sectionIndex: 0 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results[0]).toMatchObject({ resumeField: null, matchedBy: "none", confidence: 0 });
  });
});
