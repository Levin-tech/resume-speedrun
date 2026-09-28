// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  summarizeFillResults,
  orderReviewItems,
  itemTitle,
  renderReviewPanel,
} from "../../src/content/review/review.js";

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

describe("renderReviewPanel", () => {
  it("底部显示平台提示（Moka 草稿），撤销后还在；撤销结果里写明删了几段", () => {
    const panel = renderReviewPanel(summarizeFillResults([r("a", "filled")]), {
      footnote: "Moka 会自动保存草稿，撤销后如仍有残留可刷新页面检查",
    });
    const note = () => panel.root.querySelector('[data-role="draft-notice"]');
    expect(note().textContent).toBe("Moka 会自动保存草稿，撤销后如仍有残留可刷新页面检查");
    expect(note().closest("footer")).not.toBeNull();

    panel.showUndoResults([
      r("a", "restored"),
      r("added-awards-1", "restored", { controlType: "added-entry" }),
      r("gender", "failed", { reason: "这个下拉框没有清空按钮，插件没法自动清空，该项需手动清空" }),
    ]);
    const notice = panel.root.querySelector('[data-role="undo-notice"]').textContent;
    expect(notice).toContain("1 段经历已删除");
    expect(panel.root.querySelectorAll('[data-role="items"] li')).toHaveLength(1);
    expect(panel.root.querySelector('[data-role="items"] li').textContent).toContain("该项需手动清空");
    expect(note()).not.toBeNull();
  });

  it("没有平台提示时底部不多出东西；通用页面加出来但没法删的段在提示里说明", () => {
    const panel = renderReviewPanel(summarizeFillResults([]));
    expect(panel.root.querySelector('[data-role="draft-notice"]')).toBeNull();
    panel.showUndoResults([], { untrackedAdded: 2 });
    expect(panel.root.querySelector('[data-role="undo-notice"]').textContent).toContain("2 段自动添加的经历区块保留为空白");
  });
});
