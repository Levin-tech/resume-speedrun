import { describe, it, expect } from "vitest";
import { getElementDigest } from "../../src/content/scanner/scanner.js";

describe("诊断报告安全性", () => {
  it("getElementDigest 不包含任何输入值", () => {
    // 模拟一个 DOM 元素
    const mockElement = {
      tagName: "INPUT",
      className: "ant-input",
      getAttribute: (attr) => {
        const attrs = {
          role: "textbox",
          type: "text",
          "data-testid": "input-fullName",
          "aria-label": "姓名",
          value: "张三的真实姓名（不应该出现在报告里）",
        };
        return attrs[attr] || "";
      },
      parentElement: null,
    };

    const digest = getElementDigest(mockElement);

    expect(digest).toBeTruthy();
    expect(digest.tagName).toBe("input");
    expect(digest.className).toBe("ant-input");
    expect(digest.role).toBe("textbox");

    const digestStr = JSON.stringify(digest);
    expect(digestStr).not.toContain("张三");
    expect(digestStr).not.toContain("真实姓名");
    expect(digestStr).not.toContain("value");
  });

  it("getElementDigest 返回 null 如果传入 null", () => {
    expect(getElementDigest(null)).toBeNull();
  });

  it("诊断报告结构中不包含 value 字段", () => {
    const reportField = {
      id: "scan-1",
      controlType: "text",
      label: "姓名",
      sectionTitle: "基本信息",
      sectionIndex: 0,
      required: false,
      options: [],
      placeholder: "请输入姓名",
      resumeField: "basic.fullName",
      matchedBy: "keyword",
      confidence: 1.0,
      element: {
        tagName: "input",
        className: "ant-input",
        role: "",
        type: "text",
        dataTestId: "input-fullName",
        ariaLabel: "",
        depth: 5,
      },
    };

    const reportStr = JSON.stringify(reportField);
    // 确保没有泄露用户输入值的字段
    expect(Object.keys(reportField)).not.toContain("value");
    expect(Object.keys(reportField.element)).not.toContain("value");
    expect(Object.keys(reportField.element)).not.toContain("innerText");
    expect(Object.keys(reportField.element)).not.toContain("textContent");
  });
});
