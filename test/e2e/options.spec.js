// 信息库编辑页冒烟测试：加载打包好的插件（dist/），打开 options 页面，
// 填几项信息 + 新增一段教育经历，验证自动保存、刷新后数据还在、
// 导出再导入结果一致。
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

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
    // 默认的 headless 模式会用精简版 chromium-headless-shell，它不支持加载插件；
    // 没有指定预装浏览器时（如 GitHub Actions），显式使用完整版 Chromium。
    channel: executablePath ? undefined : "chromium",
    args: [
      "--headless=new",
      "--no-sandbox",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker");
  }
  const extensionId = worker.url().split("/")[2];
  return { context, extensionId };
}

async function antSelect(page, testId, optionText) {
  // Close any open dropdowns first
  await page.evaluate(() => {
    document.querySelectorAll(".ant-select-dropdown").forEach((dd) => {
      dd.style.display = "none";
    });
  });
  await page.waitForTimeout(100);

  await page.click(`[data-testid="${testId}"] .ant-select-selector`);
  await page.waitForSelector(`.ant-select-dropdown:not([style*="display: none"])`, {
    state: "visible",
    timeout: 5000,
  });

  // Click the last visible dropdown's matching option
  await page.click(
    `.ant-select-dropdown:not([style*="display: none"]) .ant-select-item-option[title="${optionText}"]`
  );
  await page.waitForTimeout(300);
}

test("信息库页面：填写、刷新后还在、导出导入结果一致", async () => {
  const { context, extensionId } = await launchWithExtension();

  try {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);

    await page.waitForSelector('[data-testid="profile-select"]');

    await page.fill('[data-testid="input-fullName"]', "张三");
    await page.fill('[data-testid="input-phone"]', "13800000000");
    await antSelect(page, "select-gender", "男");

    await page.click('[data-testid="add-education-btn"]');
    await page.waitForSelector('[data-testid="education-entry-0"]');
    await page.fill('[data-testid="input-edu-school-0"]', "速通大学");
    await antSelect(page, "select-edu-tier-0", "985");
    await antSelect(page, "select-edu-degree-0", "本科");

    // 等自动保存完成（有 400ms 防抖）。
    await expect(page.locator('[data-testid="save-status"]')).toHaveText("已保存", {
      timeout: 5000,
    });

    // 刷新页面，确认数据还在。
    await page.reload();
    await page.waitForSelector('[data-testid="profile-select"]');
    await expect(page.locator('[data-testid="input-fullName"]')).toHaveValue("张三");
    await expect(page.locator('[data-testid="input-phone"]')).toHaveValue("13800000000");
    await expect(
      page.locator('[data-testid="select-gender"] .ant-select-selection-item')
    ).toHaveText("男");
    await expect(page.locator('[data-testid="input-edu-school-0"]')).toHaveValue("速通大学");
    await expect(
      page.locator('[data-testid="select-edu-tier-0"] .ant-select-selection-item')
    ).toHaveText("985");

    // 导出 JSON。
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-testid="export-btn"]'),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // 新增一段没保存过的教育经历文案，验证"导入会覆盖为导出时的数据"。
    await page.fill('[data-testid="input-fullName"]', "李四（导入前的脏数据）");
    await expect(page.locator('[data-testid="save-status"]')).toHaveText("已保存", {
      timeout: 5000,
    });

    // 导入刚才导出的文件，结果应该和导出时一致（覆盖回"张三"）。
    await page.setInputFiles('[data-testid="import-input"]', downloadPath);
    await expect(page.locator('[data-testid="input-fullName"]')).toHaveValue("张三");
    await expect(page.locator('[data-testid="input-edu-school-0"]')).toHaveValue("速通大学");
    await expect(page.locator('[data-testid="import-error"]')).toHaveCount(0);

    // 导入格式错误的文件，应该报中文错误、且不清空已有数据。
    const badFileDir = mkdtempSync(path.join(tmpdir(), "resume-speedrun-"));
    const badFile = path.join(badFileDir, "bad.json");
    writeFileSync(badFile, "not a json");
    await page.setInputFiles('[data-testid="import-input"]', badFile);
    await expect(page.locator('[data-testid="import-error"]')).toContainText("导入失败");
    await expect(page.locator('[data-testid="input-fullName"]')).toHaveValue("张三");
  } finally {
    await context.close();
  }
});
