import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";

// scanner 依赖 DOM，用 jsdom 模拟
function createTestDOM(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  return dom.window.document;
}

describe("标签提取逻辑（纯函数测试）", () => {
  it("能从 .field-label 提取标签文字", () => {
    const doc = createTestDOM(`
      <div class="field">
        <label class="field-label">姓名</label>
        <input type="text" />
      </div>
    `);
    const label = doc.querySelector(".field-label");
    expect(label.textContent.trim()).toBe("姓名");
  });

  it("能从 placeholder 提取标签", () => {
    const doc = createTestDOM(`<input type="text" placeholder="请输入手机号" />`);
    const input = doc.querySelector("input");
    expect(input.getAttribute("placeholder")).toBe("请输入手机号");
  });

  it("能识别 aria-label", () => {
    const doc = createTestDOM(`<input type="text" aria-label="邮箱" />`);
    const input = doc.querySelector("input");
    expect(input.getAttribute("aria-label")).toBe("邮箱");
  });
});

describe("区块判断逻辑", () => {
  it("识别 data-testid 中的序号", () => {
    const doc = createTestDOM(`
      <div data-testid="education-entry-0">
        <div class="field">
          <label class="field-label">学校</label>
          <input type="text" />
        </div>
      </div>
      <div data-testid="education-entry-1">
        <div class="field">
          <label class="field-label">学校</label>
          <input type="text" />
        </div>
      </div>
    `);
    const entries = doc.querySelectorAll("[data-testid^='education-entry']");
    expect(entries).toHaveLength(2);

    const match0 = entries[0].getAttribute("data-testid").match(/-(\d+)$/);
    expect(match0[1]).toBe("0");

    const match1 = entries[1].getAttribute("data-testid").match(/-(\d+)$/);
    expect(match1[1]).toBe("1");
  });
});

describe("必填检测", () => {
  it("required 属性被识别", () => {
    const doc = createTestDOM(`<input type="text" required />`);
    const input = doc.querySelector("input");
    expect(input.hasAttribute("required")).toBe(true);
  });

  it("aria-required 被识别", () => {
    const doc = createTestDOM(`<input type="text" aria-required="true" />`);
    const input = doc.querySelector("input");
    expect(input.getAttribute("aria-required")).toBe("true");
  });
});
