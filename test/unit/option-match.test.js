import { describe, it, expect } from "vitest";
import {
  buildCandidates,
  pickBestOption,
  pickNumberOption,
  parseDateParts,
  searchKeywords,
  splitCascaderPath,
  stripAdminSuffix,
} from "../../src/content/filler/option-match.js";

describe("buildCandidates", () => {
  it("标准值 + 同义词", () => {
    expect(buildCandidates("politicalStatus", "共青团员")).toEqual(["共青团员", "团员", "共青团"]);
    expect(buildCandidates("degree", "硕士")).toContain("硕士研究生");
  });

  it("没有同义词表的字段只用原值，空值返回空数组", () => {
    expect(buildCandidates("school", "北京大学")).toEqual(["北京大学"]);
    expect(buildCandidates("school", "")).toEqual([]);
  });
});

describe("pickBestOption", () => {
  const options = ["党员", "预备党员", "团员", "群众"];

  it("同义词完全一致算完全匹配", () => {
    const pick = pickBestOption(options, buildCandidates("politicalStatus", "共青团员"));
    expect(pick).toEqual({ index: 2, text: "团员", exact: true });
  });

  it("忽略空格标点、省/市后缀也算完全匹配", () => {
    expect(pickBestOption(["广州市", "深圳市"], ["深圳"])).toMatchObject({ text: "深圳市", exact: true });
    expect(pickBestOption(["计算机科学 与 技术"], ["计算机科学与技术"])).toMatchObject({ exact: true });
  });

  it("只能找到最接近的时候标记为非完全匹配", () => {
    const pick = pickBestOption(["计算机科学与技术", "软件工程"], ["计算机科学"]);
    expect(pick).toMatchObject({ text: "计算机科学与技术", exact: false });
  });

  it("完全找不到返回 null", () => {
    expect(pickBestOption(["清华大学", "北京大学"], ["麻省理工学院"])).toBeNull();
    expect(pickBestOption([], ["任何"])).toBeNull();
  });

  it("一个字的同义词不参与模糊包含匹配，避免误选", () => {
    expect(pickBestOption(["其他（回乡）"], ["回"])).toBeNull();
  });
});

describe("数字与日期", () => {
  it("年月下拉按数字匹配", () => {
    expect(pickNumberOption(["2026年", "2025年", "2024年"], 2025)).toMatchObject({ index: 1, exact: true });
    expect(pickNumberOption(["01", "02", "12"], 12)).toMatchObject({ index: 2 });
    expect(pickNumberOption(["1月", "2月"], 12)).toBeNull();
  });

  it("parseDateParts 兼容各种写法", () => {
    expect(parseDateParts("2001-05-20")).toEqual([2001, 5, 20]);
    expect(parseDateParts("2001年5月")).toEqual([2001, 5]);
    expect(parseDateParts("")).toEqual([]);
  });
});

describe("搜索关键词与级联路径", () => {
  it("关键词由完整到宽松", () => {
    expect(searchKeywords("北京大学（医学部）")).toEqual(["北京大学（医学部）", "北京大学", "北京"]);
    expect(searchKeywords("中国")).toEqual(["中国"]);
    expect(searchKeywords("")).toEqual([]);
  });

  it("城市拆成级联路径", () => {
    expect(splitCascaderPath("广东省/深圳市")).toEqual(["广东省", "深圳市"]);
    expect(splitCascaderPath("广东 深圳")).toEqual(["广东", "深圳"]);
    expect(splitCascaderPath("深圳")).toEqual(["深圳"]);
    expect(splitCascaderPath(["浙江省", "杭州市"])).toEqual(["浙江省", "杭州市"]);
  });

  it("stripAdminSuffix 不会把两个字的地名删成一个字", () => {
    expect(stripAdminSuffix("广东省")).toBe("广东");
    expect(stripAdminSuffix("沙市")).toBe("沙市");
  });
});
