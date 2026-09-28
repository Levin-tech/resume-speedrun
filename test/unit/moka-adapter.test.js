// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mokaAdapter, hasClassBase } from "../../src/content/adapters/moka.js";
import { scanFormFields } from "../../src/content/scanner/scanner.js";

// 照实测的 Moka 结构手写一小段：类名带哈希，字段类型是 apply-field 的第二个类名。
const MOKA_HTML = `
  <div class="apply-blocks">
    <div class="apply-block">
      <div class="blockTitle-3Fq9x"><span class="blockName-a1B2c">个人信息</span></div>
      <div class="apply-fields">
        <div class="apply-field-Q2iJ7AtQGX string_info">
          <div class="title-Zx81k"><span class="required-asterisk-9Kd2f">*</span>手机号码</div>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t" readonly value="+86"></label>
          <label class="sd-Input-container-1aB2c"><input class="sd-Input-input-10L0t" id="phone"></label>
        </div>
        <div class="apply-field-Q2iJ7AtQGX Select">
          <div class="title-Zx81k">政治面貌</div>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t" readonly></label>
        </div>
        <div class="apply-field-Q2iJ7AtQGX date_info">
          <div class="title-Zx81k">毕业时间</div>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t" placeholder="年"></label>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t" placeholder="月" readonly></label>
        </div>
        <div class="apply-field-Q2iJ7AtQGX attachment_upload">
          <div class="title-Zx81k"><span class="required-asterisk-9Kd2f">*</span>附件简历</div>
        </div>
        <div class="apply-field-Q2iJ7AtQGX some_new_type">
          <div class="title-Zx81k">新类型字段</div>
        </div>
      </div>
    </div>
    <div class="apply-block">
      <div class="blockTitle-3Fq9x"><span class="blockName-a1B2c">实习经历</span><div class="blockAdd-8Hj3k"><i>+</i><span>添加</span></div></div>
      <div class="apply-fields">
        <div class="apply-field-Q2iJ7AtQGX string_info"><div class="title-Zx81k">公司名称</div><label class="sd-Input-container-1aB2c"><input class="sd-Input-input-10L0t"></label></div>
        <div class="apply-field-Q2iJ7AtQGX date_info full-width-field">
          <div class="title-Zx81k">起止时间</div>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t"></label>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t"></label>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t"></label>
          <label class="sd-Input-container-1aB2c sd-Select-container-3cD4e"><input class="sd-Input-input-10L0t"></label>
          <label class="sd-Checkbox-container-7Yu2w"><input type="checkbox"><span>至今</span></label>
        </div>
      </div>
      <div class="apply-fields">
        <div class="apply-field-Q2iJ7AtQGX string_info"><div class="title-Zx81k">公司名称</div><label class="sd-Input-container-1aB2c"><input class="sd-Input-input-10L0t"></label></div>
      </div>
    </div>
    <div class="apply-block">
      <div class="blockTitle-3Fq9x"><span class="blockName-a1B2c">教育背景</span></div>
      <div class="apply-fields">
        <div class="apply-field-Q2iJ7AtQGX string_info">
          <div class="title-Zx81k">学校名称</div>
          <div class="sd-Dropdown-trigger-5Tg6h"><label class="sd-Input-container-1aB2c"><input class="sd-Input-input-10L0t"></label></div>
        </div>
      </div>
    </div>
    <div class="apply-block">
      <div class="blockTitle-3Fq9x"><span class="blockName-a1B2c">项目经验</span><span class="blockAdd-8Hj3k">+ 添加</span></div>
    </div>
  </div>
`;

function setup() {
  document.body.innerHTML = MOKA_HTML;
  return document;
}

describe("hasClassBase", () => {
  const el = (className) => Object.assign(document.createElement("div"), { className });

  it("认本名和带哈希的写法，不认复数和普通子类名", () => {
    expect(hasClassBase(el("apply-field"), "apply-field")).toBe(true);
    expect(hasClassBase(el("apply-field-Q2iJ7AtQGX string_info"), "apply-field")).toBe(true);
    expect(hasClassBase(el("apply-fields"), "apply-field")).toBe(false);
    expect(hasClassBase(el("apply-field-title"), "apply-field")).toBe(false);
    expect(hasClassBase(el("apply-field-title-9Xk2p"), "apply-field")).toBe(false);
  });
});

describe("mokaAdapter.scanFields", () => {
  it("按 apply-field 的类型类名定控件类型、按 blockTitle 定区块、按 apply-fields 顺序定第几段", () => {
    const fields = mokaAdapter.scanFields(setup());
    expect(fields.map((f) => [f.sectionTitle, f.sectionIndex, f.label, f.controlType])).toEqual([
      ["个人信息", 0, "手机号码", "text"],
      ["个人信息", 0, "政治面貌", "select"],
      ["个人信息", 0, "毕业时间", "year-month"],
      ["个人信息", 0, "附件简历", "upload"],
      ["个人信息", 0, "新类型字段", "unknown"],
      ["实习经历", 0, "公司名称", "text"],
      ["实习经历", 0, "起止时间", "date-range-group"],
      ["实习经历", 1, "公司名称", "text"],
      ["教育背景", 0, "学校名称", "suggest"],
    ]);
    expect(fields.every((f) => f.kit === "moka")).toBe(true);
  });

  it("手机号码填后面的输入框，前面的 +86 小下拉不动", () => {
    const [phone] = mokaAdapter.scanFields(setup());
    expect(phone.subElements.input.id).toBe("phone");
    expect(phone.required).toBe(true);
  });

  it("起止时间拿到 4 个下拉和“至今”，年月组拿到 2 个下拉", () => {
    const fields = mokaAdapter.scanFields(setup());
    const range = fields.find((f) => f.controlType === "date-range-group");
    expect(Object.values(range.subElements).every(Boolean)).toBe(true);
    expect(range.subElements.isCurrent.textContent).toBe("至今");
    const yearMonth = fields.find((f) => f.controlType === "year-month");
    expect(yearMonth.subElements.year.placeholder).toBe("年");
    expect(yearMonth.subElements.month.placeholder).toBe("月");
  });

  it("上传、不认识的控件带跳过原因；只有带“添加”或多段的区块才算可重复", () => {
    const fields = mokaAdapter.scanFields(setup());
    expect(fields.find((f) => f.label === "附件简历").skipReason).toMatch(/自己上传/);
    expect(fields.find((f) => f.label === "新类型字段").skipReason).toMatch(/暂不支持/);
    expect(fields.find((f) => f.label === "手机号码").container).toBeNull();
    expect(fields.find((f) => f.label === "公司名称").container).not.toBeNull();
  });

  it("scanner 在 Moka 上优先用适配器结果，扫不到时退回通用扫描", () => {
    const doc = setup();
    const fields = scanFormFields(doc, { adapter: mokaAdapter });
    expect(fields).toHaveLength(9);
    expect(fields.map((f) => f.id)).toEqual(fields.map((_, i) => `scan-${i + 1}`));

    document.body.innerHTML = `<div class="field"><label class="field-label">姓名</label><input type="text"></div>`;
    const fallback = scanFormFields(document, { adapter: mokaAdapter });
    expect(fallback).toHaveLength(1);
    expect(fallback[0].kit).toBeUndefined();
  });
});

describe("mokaAdapter.getRepeatableSections", () => {
  it("列出带“添加”的区块（包括一段都没有的），标题不含“添加”", () => {
    const sections = mokaAdapter.getRepeatableSections(setup());
    expect(sections.map((s) => [s.title, s.countEntries(), s.findAddButton()?.textContent.trim()])).toEqual([
      ["实习经历", 2, "添加"],
      ["项目经验", 0, "+ 添加"],
    ]);
  });
});

describe("mokaAdapter.detect", () => {
  it("没有 Moka 结构、也不在 Moka 域名上时不认", () => {
    document.body.innerHTML = `<div class="ant-form-item"></div>`;
    expect(mokaAdapter.detect()).toBe(false);
    setup();
    expect(mokaAdapter.detect()).toBe(true);
  });
});
