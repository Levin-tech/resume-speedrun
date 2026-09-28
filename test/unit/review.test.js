import { describe, it, expect } from "vitest";
import { summarizeFillResults, orderReviewItems, itemTitle } from "../../src/content/review/review.js";

const r = (fieldId, status, extra = {}) => ({ fieldId, status, label: fieldId, required: false, ...extra });

describe("summarizeFillResults", () => {
  it("按状态把填写结果分成三档，并找出必填未填", () => {
    const results = [
      r("a", "filled"),
      r("b", "needs-confirmation"),
      r("c", "skipped"),
      r("d", "failed", { required: true }),
    ];
    const summary = summarizeFillResults(results);
    expect(summary.filled).toHaveLength(1);
    expect(summary.needsConfirmation).toHaveLength(1);
    expect(summary.skipped).toHaveLength(2);
    expect(summary.missingRequired.map((x) => x.fieldId)).toEqual(["d"]);
  });
});

describe("orderReviewItems", () => {
  it("必填未填置顶，其次需确认、未填、已填，同档保持页面顺序", () => {
    const ordered = orderReviewItems([
      r("filled-1", "filled"),
      r("skip-1", "skipped"),
      r("confirm-1", "needs-confirmation"),
      r("required-1", "skipped", { required: true }),
      r("filled-2", "filled", { required: true }),
      r("required-2", "failed", { required: true }),
    ]);
    expect(ordered.map((x) => x.fieldId)).toEqual([
      "required-1",
      "required-2",
      "confirm-1",
      "skip-1",
      "filled-1",
      "filled-2",
    ]);
  });
});

describe("itemTitle", () => {
  it("经历区块里的字段带上第几段", () => {
    expect(itemTitle({ label: "公司名称", repeatable: true, sectionTitle: "实习经历", sectionIndex: 1 })).toBe(
      "实习经历 第 2 段 · 公司名称"
    );
    expect(itemTitle({ label: "姓名", repeatable: false, sectionTitle: "基本信息", sectionIndex: 0 })).toBe("姓名");
  });
});
