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

describe("拆分式年月下拉组与“至今”（真实 scanFormFields）", () => {
  it("有 date-range 类名的容器：嵌套两层也只识别成一组，并找到“至今”", async () => {
    const { scanFormFields } = await import("../../src/content/scanner/scanner.js");
    const doc = createTestDOM(`
      <div class="field date-range">
        <label class="field-label">起止时间</label>
        <div class="date-range-control">
          <div class="ant-select"><span class="ant-select-selection-placeholder">起始年</span></div>
          <div class="ant-select"><span class="ant-select-selection-placeholder">起始月</span></div>
          <div class="ant-select"><span class="ant-select-selection-placeholder">结束年</span></div>
          <div class="ant-select"><span class="ant-select-selection-placeholder">结束月</span></div>
          <label class="ant-checkbox-wrapper"><input type="checkbox" />至今</label>
        </div>
      </div>
    `);
    const fields = scanFormFields(doc);
    const groups = fields.filter((f) => f.controlType === "date-range-group");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("起止时间");
    expect(groups[0].subElements.isCurrent?.textContent.trim()).toBe("至今");
    // 组里的 4 个下拉不再单独算作普通下拉
    expect(fields.filter((f) => f.controlType === "select")).toHaveLength(0);
  });

  it("没有类名时，按下拉提示文字里的“年/月”识别；普通的 4 个下拉不误判", async () => {
    const { scanFormFields } = await import("../../src/content/scanner/scanner.js");
    const doc = createTestDOM(`
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>在校时间</label></div>
        <select><option>年</option><option>2020</option></select>
        <select><option>月</option><option>1</option></select>
        <select><option>年</option><option>2024</option></select>
        <select><option>月</option><option>6</option></select>
        <label><input type="checkbox" />目前在读</label>
      </div>
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>偏好</label></div>
        <select><option>甲</option></select><select><option>乙</option></select>
        <select><option>丙</option></select><select><option>丁</option></select>
      </div>
    `);
    const fields = scanFormFields(doc);
    const groups = fields.filter((f) => f.controlType === "date-range-group");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("在校时间");
    expect(groups[0].subElements.isCurrent).toBeTruthy();
    expect(fields.filter((f) => f.controlType === "select")).toHaveLength(4);
    expect(fields.map((f) => f.id)).toEqual(fields.map((_, i) => `scan-${i + 1}`));
  });
});
