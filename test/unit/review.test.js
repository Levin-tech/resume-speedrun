import { describe, it, expect } from "vitest";
import { summarizeFillResults } from "../../src/content/review/review.js";

describe("summarizeFillResults", () => {
  it("按状态把填写结果分成三档", () => {
    const results = [
      { fieldId: "a", status: "filled" },
      { fieldId: "b", status: "needs-confirmation" },
      { fieldId: "c", status: "skipped" },
      { fieldId: "d", status: "failed" },
    ];
    const summary = summarizeFillResults(results);
    expect(summary.filled).toHaveLength(1);
    expect(summary.needsConfirmation).toHaveLength(1);
    expect(summary.skipped).toHaveLength(2);
  });
});
