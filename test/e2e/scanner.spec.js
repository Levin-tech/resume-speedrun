// 扫描与规则识别 E2E 测试：加载插件，打开测试页，
// 确认 scanner 识别到所有控件并且 matcher 匹配到正确的简历字段。
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const extensionPath = path.join(root, "dist");

const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalledChromium)
  ? preinstalledChromium
  : undefined;

async function launchWithExtension() {
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath,
    args: [
      "--headless=new",
      "--no-sandbox",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  return context;
}

test("scanner 识别测试页所有控件并正确匹配简历字段", async () => {
  const context = await launchWithExtension();

  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/");

    // 等内容脚本注入
    await page.waitForSelector("html[data-resume-speedrun-injected='true']", {
      timeout: 10_000,
    });

    // 先点添加教育经历，确保有第二段
    await page.click('[data-testid="add-education-btn"]');
    await page.waitForSelector('[data-testid="education-entry-1"]');

    // 通过 window.postMessage 桥接触发 content script 扫描
    const diagnostics = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener("message", function handler(event) {
          if (event.data?.type === "resume-speedrun:scan-diagnostics-response") {
            window.removeEventListener("message", handler);
            resolve(event.data.payload);
          }
        });
        window.postMessage({ type: "resume-speedrun:scan-diagnostics-request" }, "*");
      });
    });

    expect(diagnostics.ok).toBe(true);
    const fields = diagnostics.diagnostics.fields;
    expect(fields.length).toBeGreaterThan(0);

    // 验证基本信息字段识别
    const nameField = fields.find((f) => f.label.includes("姓名"));
    expect(nameField).toBeTruthy();
    expect(nameField.controlType).toBe("text");
    expect(nameField.resumeField).toBe("basic.fullName");

    const phoneField = fields.find((f) => f.label.includes("手机"));
    expect(phoneField).toBeTruthy();
    expect(phoneField.resumeField).toBe("basic.phone");

    const emailField = fields.find((f) => f.label.includes("邮箱"));
    expect(emailField).toBeTruthy();
    expect(emailField.resumeField).toBe("basic.email");

    // 性别 (radio group)
    const genderField = fields.find((f) => f.label.includes("性别"));
    expect(genderField).toBeTruthy();
    expect(genderField.controlType).toBe("radio");
    expect(genderField.resumeField).toBe("basic.gender");

    // 政治面貌 (select)
    const politicalField = fields.find((f) => f.label.includes("政治面貌"));
    expect(politicalField).toBeTruthy();
    expect(["select", "searchable-select"]).toContain(politicalField.controlType);
    expect(politicalField.resumeField).toBe("basic.politicalStatus");

    // 民族 (select)
    const nationField = fields.find((f) => f.label.includes("民族"));
    expect(nationField).toBeTruthy();
    expect(nationField.resumeField).toBe("basic.nation");

    // 国家 (searchable select)
    const countryField = fields.find((f) => f.label.includes("国家"));
    expect(countryField).toBeTruthy();
    expect(countryField.resumeField).toBe("basic.country");

    // 现居城市 (cascader)
    const cityField = fields.find((f) => f.label.includes("现居城市"));
    expect(cityField).toBeTruthy();
    expect(cityField.controlType).toBe("cascader");
    expect(cityField.resumeField).toBe("basic.currentCity");

    // 兴趣爱好 (checkbox group)
    const hobbiesField = fields.find((f) => f.label.includes("兴趣爱好"));
    expect(hobbiesField).toBeTruthy();
    expect(hobbiesField.controlType).toBe("checkbox");

    // 出生日期 (date picker)
    const birthField = fields.find((f) => f.label.includes("出生日期"));
    expect(birthField).toBeTruthy();
    expect(birthField.controlType).toBe("date");
    expect(birthField.resumeField).toBe("basic.birthDate");

    // 教育经历第 1 段的学校
    const school0 = fields.find(
      (f) => f.label.includes("学校") && f.sectionTitle === "教育经历" && f.sectionIndex === 0
    );
    expect(school0).toBeTruthy();
    expect(school0.resumeField).toBe("education[0].school");

    // 教育经历第 2 段的学校
    const school1 = fields.find(
      (f) => f.label.includes("学校") && f.sectionTitle === "教育经历" && f.sectionIndex === 1
    );
    expect(school1).toBeTruthy();
    expect(school1.resumeField).toBe("education[1].school");

    // 实习经历
    const companyField = fields.find(
      (f) => f.label.includes("公司") && f.sectionTitle === "实习经历"
    );
    expect(companyField).toBeTruthy();
    expect(companyField.resumeField).toBe("internships[0].company");

    // 诊断报告不含任何输入值
    const reportStr = JSON.stringify(fields);
    expect(reportStr).not.toContain('"value"');
  } finally {
    await context.close();
  }
});
