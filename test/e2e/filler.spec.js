// 填写引擎端到端测试：加载插件，往本地存储里放一份示例简历，打开测试页，
// 在插件弹窗里点"开始填写"，逐项检查页面显示、组件库表单值、自动添加的
// 第二段经历、"至今"勾选、检查清单，确认提交按钮从未被点击，最后测撤销。
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const extensionPath = path.join(root, "dist");
const FIXTURE_URL = "http://127.0.0.1:4173/";

const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(preinstalledChromium)
  ? preinstalledChromium
  : undefined;

const PROFILE = {
  id: "e2e-profile",
  schemaVersion: 1,
  name: "测试简历",
  basic: {
    fullName: "张三",
    gender: "女",
    birthDate: { year: 2001, month: 5, day: 20 },
    phone: "13800138000",
    email: "zhangsan@example.com",
    idType: "居民身份证",
    idNumber: "", // 故意留空：页面上它是必填项，检查清单应把它置顶标红
    nation: "汉族",
    politicalStatus: "共青团员", // 页面选项写的是"团员"，靠同义词表对上
    nativePlace: "",
    currentCity: "深圳", // 没写省份，级联要自己去各省下面找
    country: "中国",
  },
  expectation: {
    position: "后端开发",
    cities: ["北京", "上海"],
    currentIndustry: "",
    expectedIndustry: "",
    availableDate: { year: 2026, month: 7 },
  },
  education: [
    {
      school: "北京大学",
      schoolTier: "985",
      degree: "本科",
      degreeMode: "全日制",
      major: "计算机科学与技术",
      startDate: { year: 2019, month: 9 },
      endDate: { year: 2023, month: 6 },
      isCurrent: false,
    },
    {
      school: "清华大学",
      schoolTier: "985",
      degree: "硕士", // 页面选项写的是"硕士研究生"
      degreeMode: "全日制",
      major: "软件工程",
      startDate: { year: 2023, month: 9 },
      endDate: { year: 2026, month: 6 },
      isCurrent: false,
    },
  ],
  internships: [
    {
      company: "字节跳动",
      title: "后端开发实习生",
      department: "",
      // 12 月在下拉的虚拟列表里一开始看不到，要滚动才能选到
      startDate: { year: 2022, month: 12 },
      endDate: { year: 2023, month: 3 },
      isCurrent: false,
      description: "负责推荐系统接口开发",
    },
    {
      company: "腾讯",
      title: "算法实习生",
      department: "",
      startDate: { year: 2025, month: 7 },
      endDate: { year: null, month: null },
      isCurrent: true,
      description: "参与广告召回模型优化",
    },
  ],
  projects: [],
  skills: { englishLevel: "", skills: "", certificates: [], awards: [], selfEvaluation: "" },
};

async function launchWithExtension() {
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
async function inExtension(context, extensionId, fn, arg) {
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
async function openPopupFor(context, extensionId) {
  const [fixtureTab] = await inExtension(
    context,
    extensionId,
    (url) => chrome.tabs.query({ url: `${url}*` }),
    FIXTURE_URL
  );
  const popup = await context.newPage();
  await popup.addInitScript((tab) => {
    chrome.tabs.query = async () => [tab];
  }, fixtureTab);
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  return popup;
}

/** 存入简历 -> 打开测试页 -> 打开弹窗点"开始填写" -> 等填写完成。 */
async function fillViaPopup(context, extensionId, profile) {
  await inExtension(
    context,
    extensionId,
    (p) => chrome.storage.local.set({ resumeProfiles: [p], activeProfileId: p.id }),
    profile
  );

  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  await page.waitForSelector("html[data-resume-speedrun-injected='true']", { timeout: 10_000 });
  const initialState = await fixtureSnapshot(page);

  const popup = await openPopupFor(context, extensionId);
  await expect(popup.locator('[data-testid="profile-select"]')).toHaveValue(profile.id);
  await expect(popup.locator('[data-testid="fill-btn"]')).toBeEnabled();

  // 页面在后台时浏览器会暂停动画帧，组件库的浮层动画就不会结束；
  // 真实使用时弹窗盖在页面上、页面本身是前台，这里同样把测试页放到前台。
  await popup.click('[data-testid="fill-btn"]');
  await page.bringToFront();
  await expect(popup.locator('[data-testid="fill-summary"]')).toBeVisible({ timeout: 150_000 });
  return { page, popup, initialState };
}

async function fixtureSnapshot(page) {
  return page.evaluate(() => window.__fixture.snapshot());
}

const fixtureCounters = (page) => page.evaluate(() => ({ ...window.__fixture.counters }));
const selectText = (page, testId) =>
  page.locator(`[data-testid="${testId}"] .ant-select-selection-item`);

function dateRangeSelects(page, entryTestId) {
  const selects = page.locator(`[data-testid="${entryTestId}"] .date-range-control .ant-select`);
  return {
    startYear: selects.nth(0).locator(".ant-select-selection-item"),
    startMonth: selects.nth(1).locator(".ant-select-selection-item"),
    endYear: selects.nth(2),
    endMonth: selects.nth(3),
    current: page.locator(`[data-testid="${entryTestId}"] .date-range-control .ant-checkbox-wrapper`),
  };
}

test("开始填写：逐项填好、自动添加经历、检查清单、绝不提交、撤销后复原", async () => {
  test.setTimeout(180_000);
  const { context, extensionId } = await launchWithExtension();

  try {
    const { page, popup, initialState } = await fillViaPopup(context, extensionId, PROFILE);
    expect(initialState.education).toHaveLength(1);
    expect(initialState.internships).toHaveLength(1);
    await expect(popup.locator('[data-testid="status-text"]')).toHaveText("填写完成");

    // ---- 页面上每个控件显示的值 ----
    await expect(page.locator('[data-testid="field-full-name"] input')).toHaveValue("张三");
    await expect(page.locator('[data-testid="field-phone"] input')).toHaveValue("13800138000");
    await expect(page.locator('[data-testid="field-email"] input')).toHaveValue("zhangsan@example.com");
    await expect(page.locator('[data-testid="field-id-number"] input')).toHaveValue("");
    await expect(page.locator('[data-testid="field-gender"] .ant-radio-wrapper-checked')).toHaveText("女");
    await expect(page.locator('[data-testid="field-birth-date"] input')).toHaveValue("2001-05-20");
    await expect(selectText(page, "field-political-status")).toHaveText("团员");
    await expect(selectText(page, "field-nation")).toHaveText("汉族");
    await expect(selectText(page, "field-country")).toHaveText("中国");
    await expect(selectText(page, "field-city")).toHaveText("广东省 / 深圳市");
    await expect(page.locator('[data-testid="field-expected-cities"] .ant-checkbox-wrapper-checked')).toHaveText([
      "北京",
      "上海",
    ]);
    await expect(page.locator('[data-testid="field-available-date"] input')).toHaveValue("2026-07");
    await expect(page.locator('[data-testid="field-hobbies"] .ant-checkbox-wrapper-checked')).toHaveCount(0);

    // 第二段教育/实习是插件自己点"添加"加出来的
    await expect(page.locator('[data-testid^="education-entry-"]')).toHaveCount(2);
    await expect(page.locator('[data-testid^="internship-entry-"]')).toHaveCount(2);

    const educationExpect = [
      ["北京大学", "本科", "计算机科学与技术", "2019年", "9月", "2023年", "6月"],
      ["清华大学", "硕士研究生", "软件工程", "2023年", "9月", "2026年", "6月"],
    ];
    for (const [index, [school, degree, major, sy, sm, ey, em]] of educationExpect.entries()) {
      await expect(selectText(page, `field-school-${index}`)).toHaveText(school);
      await expect(page.locator(`[data-testid="field-degree-${index}"] [aria-checked="true"]`)).toHaveText(degree);
      await expect(selectText(page, `field-major-${index}`)).toHaveText(major);
      const range = dateRangeSelects(page, `education-entry-${index}`);
      await expect(range.startYear).toHaveText(sy);
      await expect(range.startMonth).toHaveText(sm);
      await expect(range.endYear.locator(".ant-select-selection-item")).toHaveText(ey);
      await expect(range.endMonth.locator(".ant-select-selection-item")).toHaveText(em);
      await expect(range.current).not.toHaveClass(/ant-checkbox-wrapper-checked/);
    }

    await expect(page.locator('[data-testid="field-company-0"] input')).toHaveValue("字节跳动");
    await expect(page.locator('[data-testid="field-title-0"] input')).toHaveValue("后端开发实习生");
    await expect(page.locator('[data-testid="field-description-0"] textarea')).toHaveValue("负责推荐系统接口开发");
    const internship0 = dateRangeSelects(page, "internship-entry-0");
    await expect(internship0.startYear).toHaveText("2022年");
    await expect(internship0.startMonth).toHaveText("12月");
    await expect(internship0.endYear.locator(".ant-select-selection-item")).toHaveText("2023年");
    await expect(internship0.endMonth.locator(".ant-select-selection-item")).toHaveText("3月");

    await expect(page.locator('[data-testid="field-company-1"] input')).toHaveValue("腾讯");
    await expect(page.locator('[data-testid="field-title-1"] input')).toHaveValue("算法实习生");
    await expect(page.locator('[data-testid="field-description-1"] textarea')).toHaveValue("参与广告召回模型优化");
    const internship1 = dateRangeSelects(page, "internship-entry-1");
    await expect(internship1.startYear).toHaveText("2025年");
    await expect(internship1.startMonth).toHaveText("7月");
    // "至今"已勾选，结束时间没填（且被页面禁用）
    await expect(internship1.current).toHaveClass(/ant-checkbox-wrapper-checked/);
    await expect(internship1.endYear.locator(".ant-select-selection-item")).toHaveCount(0);
    await expect(internship1.endMonth.locator(".ant-select-selection-item")).toHaveCount(0);
    await expect(internship1.endYear).toHaveClass(/ant-select-disabled/);

    // ---- 组件库内部的表单值真的更新了（不是只改了显示）----
    const state = await fixtureSnapshot(page);
    expect(state).toMatchObject({
      fullName: "张三",
      phone: "13800138000",
      email: "zhangsan@example.com",
      idNumber: "",
      gender: "女",
      birthDate: "2001-05-20",
      politicalStatus: "团员",
      nation: "汉族",
      country: "中国",
      city: ["guangdong", "shenzhen"],
      expectedCities: ["bj", "sh"],
      hobbies: [],
      submitted: false,
    });
    expect(state.availableDate).toMatch(/^2026-07-/);
    expect(state.education).toEqual([
      {
        school: "北京大学",
        degree: "本科",
        major: "计算机科学与技术",
        startYear: 2019,
        startMonth: 9,
        endYear: 2023,
        endMonth: 6,
        isCurrent: false,
      },
      {
        school: "清华大学",
        degree: "硕士研究生",
        major: "软件工程",
        startYear: 2023,
        startMonth: 9,
        endYear: 2026,
        endMonth: 6,
        isCurrent: false,
      },
    ]);
    expect(state.internships).toEqual([
      {
        company: "字节跳动",
        title: "后端开发实习生",
        startYear: 2022,
        startMonth: 12,
        endYear: 2023,
        endMonth: 3,
        isCurrent: false,
        description: "负责推荐系统接口开发",
      },
      {
        company: "腾讯",
        title: "算法实习生",
        startYear: 2025,
        startMonth: 7,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: "参与广告召回模型优化",
      },
    ]);

    // "添加"各点了一次；提交按钮一次都没被点过
    const counters = await fixtureCounters(page);
    expect(counters).toEqual({ submitClicks: 0, addEducationClicks: 1, addInternshipClicks: 1 });
    await expect(page.locator('[data-testid="submitted-marker"]')).toHaveCount(0);

    // ---- 页面上的检查清单 ----
    const panel = page.locator('[data-role="review-panel"]');
    await expect(panel).toBeVisible();
    const items = panel.locator('[data-role="items"] li');
    // 必填但没填的"身份证号"置顶、标红
    await expect(items.first()).toHaveAttribute("data-status", "skipped");
    await expect(items.first()).toContainText("身份证号");
    await expect(items.first()).toContainText("必填");
    await expect(panel.locator('[data-role="required-warning"]')).toContainText("1 个必填项");
    // 没认出来的"兴趣爱好"是未填（红），其余都是已填（绿）
    await expect(panel.locator('li[data-status="skipped"]')).toHaveCount(2);
    await expect(panel.locator('li[data-status="skipped"]').nth(1)).toContainText("兴趣爱好");
    await expect(panel.locator('li[data-status="failed"]')).toHaveCount(0);
    await expect(panel.locator('li[data-status="needs-confirmation"]')).toHaveCount(0);
    await expect(panel.locator('li[data-status="filled"]')).toHaveCount(27);
    await expect(panel.locator('[data-count="filled"]')).toHaveText("已填 27");
    await expect(panel.locator('li[data-status="filled"]', { hasText: "实习经历 第 2 段 · 起止时间" })).toContainText(
      "2025-07 ~ 至今"
    );
    await expect(panel.locator('[data-role="submit-notice"]')).toContainText("插件不会替你提交");

    // 点清单条目会把页面滚动到那个字段
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel.locator("li", { hasText: "实习经历 第 2 段 · 工作内容" }).click();
    await expect(page.locator('[data-testid="field-description-1"] textarea')).toBeInViewport();

    // ---- 撤销 ----
    await panel.locator('[data-action="undo"]').click();
    await expect(panel.locator('[data-role="undo-notice"]')).toBeVisible({ timeout: 120_000 });

    const undone = await fixtureSnapshot(page);
    const blankEducation = {
      school: null,
      degree: null,
      major: null,
      startYear: null,
      startMonth: null,
      endYear: null,
      endMonth: null,
      isCurrent: false,
    };
    const blankInternship = {
      company: "",
      title: "",
      startYear: null,
      startMonth: null,
      endYear: null,
      endMonth: null,
      isCurrent: false,
      description: "",
    };
    // 单选框（性别、学历）选中后，页面本身就不提供"取消选择"，人也做不到，
    // 插件会在清单里标出来让用户手动检查；其余所有控件都恢复成填写前的样子。
    expect(undone).toEqual({
      ...initialState,
      gender: "女",
      education: [
        { ...blankEducation, degree: "本科" },
        { ...blankEducation, degree: "硕士研究生" },
      ],
      internships: [blankInternship, blankInternship],
    });
    await expect(page.locator('[data-testid="field-full-name"] input')).toHaveValue("");
    await expect(page.locator('[data-testid="field-birth-date"] input')).toHaveValue("");
    await expect(page.locator('[data-testid="field-available-date"] input')).toHaveValue("");
    await expect(page.locator(".ant-select-selection-item")).toHaveCount(0);
    const undoFailures = panel.locator('[data-role="items"] li');
    await expect(undoFailures).toHaveCount(3);
    await expect(undoFailures.nth(0)).toContainText("性别");
    await expect(undoFailures.nth(0)).toContainText("没还原");
    await expect(undoFailures.nth(0)).toContainText("没法取消");

    const finalCounters = await fixtureCounters(page);
    expect(finalCounters.submitClicks).toBe(0);
  } finally {
    await context.close();
  }
});

test("可搜索下拉：找不到完全一样的选最接近的并标“需确认”，完全找不到就不填", async () => {
  test.setTimeout(120_000);
  const { context, extensionId } = await launchWithExtension();
  try {
    const profile = {
      ...PROFILE,
      id: "e2e-fuzzy",
      education: [
        {
          ...PROFILE.education[0],
          school: "麻省理工学院", // 选项里根本没有
          major: "计算机科学", // 选项里只有"计算机科学与技术"
        },
      ],
      internships: [],
    };
    const { page } = await fillViaPopup(context, extensionId, profile);

    await expect(page.locator('[data-testid="field-school-0"] .ant-select-selection-item')).toHaveCount(0);
    await expect(page.locator('[data-testid="field-school-0"] input')).toHaveValue("");
    await expect(page.locator('[data-testid="field-major-0"] .ant-select-selection-item')).toHaveText(
      "计算机科学与技术"
    );
    const state = await fixtureSnapshot(page);
    expect(state.education[0].school).toBeNull();
    expect(state.education[0].major).toBe("计算机科学与技术");
    // 简历里只有 1 段教育、没有实习：不点任何"添加"
    expect(await fixtureCounters(page)).toEqual({ submitClicks: 0, addEducationClicks: 0, addInternshipClicks: 0 });

    const panel = page.locator('[data-role="review-panel"]');
    const school = panel.locator("li", { hasText: "学校（可搜索）" });
    await expect(school).toHaveAttribute("data-status", "skipped");
    await expect(school).toContainText("找不到「麻省理工学院」");
    const major = panel.locator("li", { hasText: "专业（可搜索）" });
    await expect(major).toHaveAttribute("data-status", "needs-confirmation");
    await expect(major).toContainText("选了最接近的「计算机科学与技术」");
    await expect(panel.locator('[data-count="needs-confirmation"]')).toHaveText("需确认 1");
    // 实习经历页面上有一段，简历里没有：标为未填
    await expect(panel.locator("li", { hasText: "实习经历 第 1 段 · 公司名称" })).toContainText("简历里没有第 1 段");
  } finally {
    await context.close();
  }
});
