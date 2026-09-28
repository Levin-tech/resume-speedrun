// 端到端测试共用：带插件启动浏览器、在插件页面里执行代码、通过弹窗点"开始填写"、
// 通过 postMessage 桥接拿扫描诊断结果。
import { expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const extensionPath = path.join(root, "dist");

const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined;

export async function launchWithExtension() {
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath,
    // 默认的 headless 模式会用精简版 chromium-headless-shell，它不支持加载插件；
    // 没有指定预装浏览器时（如 GitHub Actions），显式使用完整版 Chromium。
    channel: executablePath ? undefined : "chromium",
    viewport: { width: 1280, height: 900 },
    args: [
      "--headless=new",
      "--no-sandbox",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  return { context, extensionId };
}

/** 在插件自己的页面里执行一段代码（能用 chrome.storage / chrome.tabs）。 */
export async function inExtension(context, extensionId, fn, arg) {
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    return await page.evaluate(fn, arg);
  } finally {
    await page.close();
  }
}

/**
 * 打开插件弹窗页。测试里弹窗只能当普通标签页打开，这时"当前标签页"
 * 会是弹窗自己，所以把 chrome.tabs.query 指向测试页那个标签页。
 */
export async function openPopupFor(context, extensionId, url) {
  const [fixtureTab] = await inExtension(context, extensionId, (u) => chrome.tabs.query({ url: `${u}*` }), url);
  const popup = await context.newPage();
  await popup.addInitScript((tab) => {
    chrome.tabs.query = async () => [tab];
  }, fixtureTab);
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  return popup;
}

/** 存入简历 -> 打开测试页 -> 打开弹窗点"开始填写" -> 等填写完成。 */
export async function fillViaPopup(context, extensionId, profile, url) {
  await inExtension(
    context,
    extensionId,
    (p) => chrome.storage.local.set({ resumeProfiles: [p], activeProfileId: p.id }),
    profile
  );

  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector("html[data-resume-speedrun-injected='true']", { timeout: 10_000 });
  const initialState = await page.evaluate(() => window.__fixture.snapshot());

  const popup = await openPopupFor(context, extensionId, url);
  await expect(popup.locator('[data-testid="profile-select"]')).toHaveValue(profile.id);
  await expect(popup.locator('[data-testid="fill-btn"]')).toBeEnabled();

  // 页面在后台时浏览器会暂停动画帧，组件库的浮层动画就不会结束；
  // 真实使用时弹窗盖在页面上、页面本身是前台，这里同样把测试页放到前台。
  await popup.click('[data-testid="fill-btn"]');
  await page.bringToFront();
  await expect(popup.locator('[data-testid="fill-summary"]')).toBeVisible({ timeout: 150_000 });
  return { page, popup, initialState };
}

/** 通过 window.postMessage 桥接让内容脚本扫描页面，拿回诊断结果（不含任何填写值）。 */
export function scanDiagnostics(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        window.addEventListener("message", function handler(event) {
          if (event.data?.type === "resume-speedrun:scan-diagnostics-response") {
            window.removeEventListener("message", handler);
            resolve(event.data.payload);
          }
        });
        window.postMessage({ type: "resume-speedrun:scan-diagnostics-request" }, "*");
      })
  );
}
