import { describe, it, expect } from "vitest";
import { GENERIC_KEYWORD_RULES, matchFields } from "../../src/content/matcher/matcher.js";

describe("GENERIC_KEYWORD_RULES", () => {
  it("覆盖了基本信息里最常见的字段", () => {
    expect(GENERIC_KEYWORD_RULES["姓名"]).toBe("basic.fullName");
    expect(GENERIC_KEYWORD_RULES["政治面貌"]).toBe("basic.politicalStatus");
  });
});

describe("matchFields (第 0 阶段占位实现)", () => {
  it("对每个字段都返回一个 MatchResult", async () => {
    const fields = [{ id: "f1" }, { id: "f2" }];
    const results = await matchFields(fields, { platform: "generic", useAi: false });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ fieldId: "f1", matchedBy: "none" });
  });
});
