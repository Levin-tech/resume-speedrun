import { describe, it, expect } from "vitest";
import { getSynonymMap } from "../../src/shared/options-data/synonyms.js";
import { SUBMIT_LIKE_BLACKLIST } from "../../src/content/filler/filler.js";

describe("getSynonymMap", () => {
  it("能查到政治面貌的同义词表", () => {
    const map = getSynonymMap("politicalStatus");
    expect(map["共青团员"]).toContain("团员");
  });

  it("查不到的字段返回 null", () => {
    expect(getSynonymMap("notAField")).toBeNull();
  });
});

describe("SUBMIT_LIKE_BLACKLIST", () => {
  it("包含常见的提交/删除类按钮文案", () => {
    expect(SUBMIT_LIKE_BLACKLIST).toEqual(
      expect.arrayContaining(["提交", "保存", "删除"])
    );
  });
});
