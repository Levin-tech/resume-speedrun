import { describe, it, expect } from "vitest";
import {
  GENERIC_KEYWORD_RULES,
  matchFields,
  computeLabelScore,
  detectSectionFromTitle,
  planSectionArrays,
} from "../../src/content/matcher/matcher.js";

describe("planSectionArrays", () => {
  const internshipsOnly = { internships: [{}], workExperiences: [] };

  it("默认：工作经历用 workExperiences", () => {
    expect(planSectionArrays(["工作经历", "实习经历"], internshipsOnly).work).toBe("workExperiences");
    expect(planSectionArrays(["工作经历"], { internships: [{}], workExperiences: [{}] }).work).toBe(
      "workExperiences"
    );
  });

  it("页面只有“工作经历”、简历只填了实习（旧版本的“实习/工作经历”）时，用实习经历来填", () => {
    expect(planSectionArrays(["基本信息", "工作经历"], internshipsOnly).work).toBe("internships");
    expect(planSectionArrays(["工作经历"], null).work).toBe("workExperiences");
  });
});

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

  it("识别实习/工作经历：工作经历单独一类，混写的算实习", () => {
    expect(detectSectionFromTitle("实习经历")).toBe("internship");
    expect(detectSectionFromTitle("工作经历")).toBe("work");
    expect(detectSectionFromTitle("实习/工作经历")).toBe("internship");
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

  it("Moka 上常见的字段：汇总项、薪资、兴趣爱好、获奖、自我描述、语言能力", async () => {
    const labels = {
      最高学历: "derived.highestDegree",
      最近毕业专业: "derived.latestMajor",
      毕业时间: "derived.graduationDate",
      目前职位: "derived.currentTitle",
      语言能力: "derived.languageAbility",
      当前薪资: "expectation.currentSalary",
      期望薪资: "expectation.expectedSalary",
      意向工作城市: "expectation.cities",
      所在行业: "expectation.currentIndustry",
      期望行业: "expectation.expectedIndustry",
      到岗时间: "expectation.availableDate",
      技能: "skills.skills",
      兴趣爱好: "skills.hobbies",
      获奖经历: "skills.awards",
      自我描述: "skills.selfEvaluation",
    };
    const fields = Object.keys(labels).map((label, i) => ({
      id: `f${i}`,
      label,
      controlType: "text",
      sectionTitle: "个人信息",
      sectionIndex: 0,
    }));
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(Object.fromEntries(results.map((r, i) => [fields[i].label, r.resumeField]))).toEqual(labels);
  });

  it("信息库里本来就没有的项标 unavailable，不乱猜", async () => {
    const fields = ["推荐码", "汇报对象", "离职原因", "简历更新时间"].map((label, i) => ({
      id: `f${i}`,
      label,
      controlType: "text",
      sectionTitle: "工作经历",
      sectionIndex: 0,
    }));
    const results = await matchFields(fields, { platform: "moka", useAi: false });
    for (const r of results) expect(r).toMatchObject({ resumeField: null, unavailable: true });
  });

  it("平台适配器规则优先（标签完全一致才算），只用于经历区块外", async () => {
    const adapterRules = { "basic.currentCity": ["所在地"], "basic.workYears": ["工作经验"] };
    const fields = [
      { id: "a", label: "所在地", controlType: "cascader", sectionTitle: "个人信息", sectionIndex: 0, container: null },
      { id: "b", label: "户口所在地", controlType: "text", sectionTitle: "个人信息", sectionIndex: 0, container: null },
      { id: "c", label: "工作经验", controlType: "select", sectionTitle: "个人信息", sectionIndex: 0, container: null },
    ];
    const results = await matchFields(fields, { platform: "moka", adapterRules, useAi: false });
    expect(results[0]).toMatchObject({ resumeField: "basic.currentCity", matchedBy: "adapter" });
    expect(results[1].resumeField).toBeNull();
    expect(results[2]).toMatchObject({ resumeField: "basic.workYears", matchedBy: "adapter" });
  });

  it("工作经历和实习经历分别对应 workExperiences 和 internships；教育区块里的“毕业时间”是那一段的结束时间", async () => {
    const fields = [
      { id: "w", label: "公司名称", controlType: "text", sectionTitle: "工作经历", sectionIndex: 1 },
      { id: "i", label: "公司名称", controlType: "text", sectionTitle: "实习经历", sectionIndex: 0 },
      { id: "d", label: "起止时间", controlType: "date-range-group", sectionTitle: "工作经历", sectionIndex: 0 },
      { id: "g", label: "毕业时间", controlType: "year-month", sectionTitle: "教育背景", sectionIndex: 1 },
    ];
    const results = await matchFields(fields, { platform: "moka", useAi: false });
    expect(results.map((r) => r.resumeField)).toEqual([
      "workExperiences[1].company",
      "internships[0].company",
      "workExperiences[0].dateRange",
      "education[1].endDate",
    ]);
  });

  describe("真实 Moka 页面上发现的映射问题", () => {
    const f = (label, sectionTitle, sectionIndex = 0, controlType = "text") => ({
      id: `${sectionTitle}-${sectionIndex}-${label}`,
      label,
      controlType,
      sectionTitle,
      sectionIndex,
      container: sectionTitle === "个人信息" || sectionTitle === "求职意向" ? null : {},
    });
    const match = async (fields) => {
      const results = await matchFields(fields, { platform: "moka", useAi: false });
      return results.map((r) => (r.unavailable ? "信息库无此项" : r.resumeField));
    };

    it("经历里的公司规模、公司性质不是公司名称（信息库无此项）", async () => {
      expect(
        await match([
          f("公司名称", "工作经历"),
          f("公司规模", "工作经历", 0, "select"),
          f("公司性质", "工作经历", 0, "select"),
          f("企业性质", "实习经历", 1, "select"),
        ])
      ).toEqual(["workExperiences[0].company", "信息库无此项", "信息库无此项", "信息库无此项"]);
    });

    it("经历里的所在行业不用求职意向里的行业；求职意向里的照旧", async () => {
      expect(
        await match([
          f("所在行业", "工作经历", 0, "select"),
          f("所在行业", "实习经历", 1, "select"),
          f("所在行业", "项目经验", 0, "select"),
          f("所在行业", "求职意向", 0, "select"),
          f("期望行业", "求职意向", 0, "select"),
        ])
      ).toEqual([
        "信息库无此项",
        "信息库无此项",
        "信息库无此项",
        "expectation.currentIndustry",
        "expectation.expectedIndustry",
      ]);
    });

    it("工作/实习的“工作职责”是那段经历的工作内容", async () => {
      expect(
        await match([f("工作职责", "工作经历", 0, "textarea"), f("工作职责", "实习经历", 1, "textarea")])
      ).toEqual(["workExperiences[0].description", "internships[1].description"]);
    });

    it("项目的“职责”是项目角色，“项目中职责”“项目描述”是项目描述", async () => {
      expect(
        await match([
          f("职责", "项目经验", 0),
          f("项目中职责", "项目经验", 0, "textarea"),
          f("项目描述", "项目经验", 1, "textarea"),
          f("项目角色", "项目经验", 1),
        ])
      ).toEqual(["projects[0].role", "projects[0].description", "projects[1].description", "projects[1].role"]);
    });

    it("获奖经历区块的奖项名称按段对应获奖列表；获奖时间信息库没有", async () => {
      expect(
        await match([
          f("奖项名称", "获奖经历", 0),
          f("奖项名称", "获奖经历", 1),
          f("获奖时间", "获奖经历", 1, "year-month"),
          // 别的网站上"获奖经历"只是一个大文本框：还是填整个获奖列表
          { ...f("获奖经历", "其他信息", 0, "textarea"), container: null },
        ])
      ).toEqual(["awards[0].name", "awards[1].name", "信息库无此项", "skills.awards"]);
    });

    it("语言能力区块：语言类型、听说、读写，只填第 1 段", async () => {
      expect(
        await match([
          f("语言类型", "语言能力", 0, "select"),
          f("听说能力", "语言能力", 0, "select"),
          f("读写能力", "语言能力", 0, "select"),
          f("语言类型", "语言能力", 1, "select"),
        ])
      ).toEqual(["derived.languageType", "derived.languageListenSpeak", "derived.languageReadWrite", null]);
    });

    it("获奖经历区块对应 awards", () => {
      expect(detectSectionFromTitle("获奖经历")).toBe("award");
      expect(planSectionArrays(["获奖经历"], null).award).toBe("awards");
    });
  });

  it("没把握的字段标记为 none", async () => {
    const fields = [
      { id: "f1", label: "某个完全未知的字段", controlType: "text", sectionTitle: "", sectionIndex: 0 },
    ];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results[0]).toMatchObject({ resumeField: null, matchedBy: "none", confidence: 0 });
  });
});
