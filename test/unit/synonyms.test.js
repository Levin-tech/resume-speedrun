import { describe, it, expect } from "vitest";
import { getSynonymMap, resolveStandardValue } from "../../src/shared/options-data/synonyms.js";
import { SUBMIT_LIKE_BLACKLIST } from "../../src/content/filler/filler.js";
import { NATION } from "../../src/shared/options-data/standard-values.js";

describe("getSynonymMap", () => {
  it("能查到政治面貌的同义词表", () => {
    const map = getSynonymMap("politicalStatus");
    expect(map["共青团员"]).toContain("团员");
  });

  it("查不到的字段返回 null", () => {
    expect(getSynonymMap("notAField")).toBeNull();
  });

  it("民族同义词包含“汉/汉族”写法", () => {
    const map = getSynonymMap("nation");
    expect(map["汉族"]).toContain("汉");
  });

  it("英语等级同义词包含 CET-4/四级 写法", () => {
    const map = getSynonymMap("englishLevel");
    expect(map["CET-4"]).toContain("四级");
  });
});

describe("Moka 实测选项", () => {
  it("政治面貌：八个民主党派和无党派人士都有标准值，群众不再和无党派混在一起", () => {
    const mokaOptions = [
      "中共党员",
      "中共预备党员",
      "共青团员",
      "民革党员",
      "民盟盟员",
      "民建会员",
      "民进会员",
      "农工党党员",
      "致公党党员",
      "九三学社社员",
      "台盟盟员",
      "无党派人士",
      "群众",
    ];
    for (const option of mokaOptions) expect(resolveStandardValue("politicalStatus", option)).toBe(option);
    expect(getSynonymMap("politicalStatus")["群众"]).not.toContain("无党派人士");
  });

  it("工作经验、行业、最高学历有同义词", () => {
    expect(resolveStandardValue("workYears", "应届毕业生")).toBe("应届生");
    expect(resolveStandardValue("currentIndustry", "互联网")).toBe("互联网/IT");
    expect(resolveStandardValue("expectedIndustry", "医疗健康")).toBe("生物医药");
    expect(resolveStandardValue("highestDegree", "硕士研究生")).toBe("硕士");
  });
});

describe("resolveStandardValue", () => {
  it("能通过同义词反查出标准值", () => {
    expect(resolveStandardValue("politicalStatus", "团员")).toBe("共青团员");
    expect(resolveStandardValue("englishLevel", "六级")).toBe("CET-6");
  });

  it("查不到时返回 null", () => {
    expect(resolveStandardValue("politicalStatus", "外星人")).toBeNull();
  });
});

describe("NATION 标准值", () => {
  it("包含完整 56 个民族（另加“其他”兜底项）", () => {
    expect(NATION).toHaveLength(57);
    expect(NATION.filter((n) => n !== "其他")).toHaveLength(56);
    expect(NATION).toContain("汉族");
    expect(NATION).toContain("其他");
  });
});

describe("SUBMIT_LIKE_BLACKLIST", () => {
  it("包含常见的提交/删除类按钮文案", () => {
    expect(SUBMIT_LIKE_BLACKLIST).toEqual(
      expect.arrayContaining(["提交", "保存", "删除"])
    );
  });
});
