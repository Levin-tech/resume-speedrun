/**
 * 各控件填写/撤销的统一返回形状。
 * 填写：filled（已填）/ needs-confirmation（需确认）/ skipped、failed（未填）。
 * 撤销：restored（已还原）/ unchanged（本来就没变）/ failed（没法自动还原）。
 */

export const filled = (filledText) => ({ status: "filled", filledText, reason: "" });

export const needsConfirmation = (filledText, reason) => ({
  status: "needs-confirmation",
  filledText,
  reason,
});

export const skipped = (reason) => ({ status: "skipped", reason });

export const failed = (reason) => ({ status: "failed", reason });

export const restored = () => ({ status: "restored", reason: "" });

export const unchanged = () => ({ status: "unchanged", reason: "" });
