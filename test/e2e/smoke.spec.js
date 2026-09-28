// 冒烟测试：加载打包好的插件（dist/），打开本地测试页，
// 确认内容脚本已经被注入到页面里。
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const extensionPath = path.join(root, "dist");

// 某些环境（如本仓库的云端沙盒）预装了固定路径的 Chromium，跳过
// `playwright install` 直接复用它；本机开发环境走 Playwright 默认查找即可。
const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalledChromium)
  ? preinstalledChromium
  : undefined;

test("content script 已注入到测试页", async () => {
  const context = await chromium.launchPersistentContext("", {
    // Manifest V3 扩展需要真实渲染的 Chromium；"new" headless 模式
    // （Chromium 112+）已支持加载扩展，不需要额外的虚拟显示器。
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

  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/");
    await page.waitForSelector("html[data-resume-speedrun-injected='true']", {
      timeout: 10_000,
    });

    await expect(page.locator("html")).toHaveAttribute(
      "data-resume-speedrun-injected",
      "true"
    );

    // 顺带确认测试页本身正常渲染出了真实的 Ant Design Vue 组件。
    await expect(page.locator('[data-testid="submit-btn"]')).toBeVisible();
  } finally {
    await context.close();
  }
});
