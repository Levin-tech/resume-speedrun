// Moka 仿真页（test/fixtures/moka，照 2026-09 实测的 app.mokahr.com 结构复刻）端到端测试：
// 扫描识别、逐项填写（下拉、年月、至今、籍贯、出生日期翻页、联想输入、可搜索下拉）、
// 自动添加经历、检查清单、"预览并提交"一次都没被点、撤销后复原（清空下拉、删掉
// 插件自己加的空白经历段，用户改过的段不删）。
import { test, expect } from "@playwright/test";
import { launchWithExtension, fillViaPopup, scanDiagnostics } from "./helpers.js";
import { MOKA_PROFILE } from "./moka-profile.js";

const MOKA_URL = "http://127.0.0.1:4173/moka/";

const field = (page, id) => page.locator(`[data-fixture="${id}"]`);
const inputsOf = (page, id) => field(page, id).locator("input:not([type='checkbox'])");
const valuesOf = (page, id) => inputsOf(page, id).evaluateAll((els) => els.map((el) => el.value));
// 页面上看到的值：下拉/地区选中的文字在 sd-Input-display-value 里（input.value 是空的）。
const shownOf = (page, id) =>
  field(page, id)
    .locator('[class*="sd-Input-container"]')
    .evaluateAll((els) =>
      els.map((el) =>
        (el.querySelector('[class*="sd-Input-display-value"]')?.textContent ?? el.querySelector("input")?.value ?? "").trim()
      )
    );
const shown = async (page, id) => (await shownOf(page, id))[0];

test("Moka 仿真页本身：类名带随机哈希，下拉只响应 mousedown", async () => {
  const { context } = await launchWithExtension();
  try {
    const page = await context.newPage();
    await page.goto(MOKA_URL);
    await page.waitForSelector("html[data-resume-speedrun-injected='true']");

    const classes = await field(page, "gender").evaluate((el) => [
      el.className,
      el.querySelector("input").className,
    ]);
    expect(classes[0]).toMatch(/^apply-field-\w+ Select-\w+$/);
    expect(classes[1]).toMatch(/^sd-Input-input-\w+$/);

    // 只派发 click 打不开；按实测顺序 pointerdown -> mousedown -> focus -> mouseup -> click 才打开。
    const gender = inputsOf(page, "gender");
    await gender.evaluate((el) => el.click());
    await expect(field(page, "gender").locator('[class*="sd-Dropdown-dropdown"]')).toHaveCount(0);
    await gender.dispatchEvent("mousedown");
    await expect(field(page, "gender").locator('[class*="sd-Menu-content-item"]')).toHaveText(["男", "女"]);

    // 选中后 input.value 仍然是空的，选中的文字显示在同一个 label 里的 display-value 元素里。
    await field(page, "gender").locator('[class*="sd-Menu-content-item"]', { hasText: "女" }).click();
    await expect(gender).toHaveValue("");
    await expect(field(page, "gender").locator('[class*="sd-Input-display-value"]')).toHaveText("女");

    // 出生日期的年份列表默认停在 1990 年那一页，2001 年要翻页才看得到。
    await inputsOf(page, "birth-date").dispatchEvent("mousedown");
    await field(page, "birth-date").locator('[class*="sd-basic-selector-year"]').click();
    const yearOptions = field(page, "birth-date").locator('[class*="sd-basic-selector-year-option"]');
    await expect(yearOptions).toHaveCount(12);
    await expect(yearOptions.filter({ hasText: "1990年" })).toHaveCount(1);
    await expect(yearOptions.filter({ hasText: "2001年" })).toHaveCount(0);

    // 意向工作城市：不输入不给选项，输入后隔一会儿才出联想结果。
    const city = inputsOf(page, "intention-city");
    await city.dispatchEvent("mousedown");
    await expect(field(page, "intention-city").locator('[class*="sd-Menu-content-item"]')).toHaveCount(0);
    await city.fill("深");
    await expect(field(page, "intention-city").locator('[class*="sd-Menu-content-item"]')).toHaveText(["深圳", "深州"]);

    // 可重复区块的每一段都有"删除本条"，Moka 自动把草稿存在 localStorage。
    await expect(page.locator('[data-fixture="delete-education-0"]')).toHaveText(/删除本条/);
    expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("apply-draft")))).toBe(true);
  } finally {
    await context.close();
  }
});

test("Moka 仿真页：扫描识别所有字段，类型、区块、段序、对应简历字段都正确", async () => {
  const { context } = await launchWithExtension();
  try {
    const page = await context.newPage();
    await page.goto(MOKA_URL);
    await page.waitForSelector("html[data-resume-speedrun-injected='true']");
    // 用户自己先点一次"添加"，教育背景变成两段
    await page.locator('[data-fixture="add-education"] span', { hasText: "添加" }).click();
    await expect(field(page, "school-1")).toBeVisible();
    await page.locator('[data-fixture="add-project"] span', { hasText: "添加" }).click();
    await expect(field(page, "project-name-0")).toBeVisible();

    const { ok, diagnostics } = await scanDiagnostics(page);
    expect(ok).toBe(true);
    expect(diagnostics.platform).toBe("moka");

    const rows = diagnostics.fields.map((f) => [
      f.sectionTitle,
      f.sectionIndex,
      f.label,
      f.controlType,
      f.unavailable ? "信息库无此项" : f.skipReason ? "跳过" : f.resumeField,
    ]);
    expect(rows).toEqual([
      ["个人信息", 0, "附件简历", "upload", "跳过"],
      ["个人信息", 0, "照片", "upload", "跳过"],
      ["个人信息", 0, "姓名", "text", "basic.fullName"],
      ["个人信息", 0, "手机号码", "text", "basic.phone"],
      ["个人信息", 0, "邮箱", "text", "basic.email"],
      ["个人信息", 0, "性别", "select", "basic.gender"],
      ["个人信息", 0, "出生日期", "date", "basic.birthDate"],
      ["个人信息", 0, "证件号码", "text", "basic.idNumber"],
      ["个人信息", 0, "政治面貌", "select", "basic.politicalStatus"],
      ["个人信息", 0, "民族", "select", "basic.nation"],
      ["个人信息", 0, "籍贯", "cascader", "basic.nativePlace"],
      ["个人信息", 0, "所在地", "cascader", "basic.currentCity"],
      ["个人信息", 0, "工作经验", "select", "basic.workYears"],
      ["个人信息", 0, "最高学历", "select", "derived.highestDegree"],
      ["个人信息", 0, "最近毕业专业", "suggest", "derived.latestMajor"],
      ["个人信息", 0, "毕业时间", "year-month", "derived.graduationDate"],
      ["个人信息", 0, "目前职位", "text", "derived.currentTitle"],
      ["个人信息", 0, "当前薪资", "text", "expectation.currentSalary"],
      ["个人信息", 0, "推荐码", "text", "信息库无此项"],
      ["个人信息", 0, "简历更新时间", "year-month", "信息库无此项"],
      ["求职意向", 0, "意向工作城市", "select", "expectation.cities"],
      ["求职意向", 0, "期望职位", "text", "expectation.position"],
      ["求职意向", 0, "所在行业", "select", "expectation.currentIndustry"],
      ["求职意向", 0, "期望行业", "select", "expectation.expectedIndustry"],
      ["求职意向", 0, "期望薪资", "text", "expectation.expectedSalary"],
      ["求职意向", 0, "到岗时间", "year-month", "expectation.availableDate"],
      ["教育背景", 0, "学校名称", "suggest", "education[0].school"],
      ["教育背景", 0, "专业名称", "suggest", "education[0].major"],
      ["教育背景", 0, "学历", "select", "education[0].degree"],
      ["教育背景", 0, "起止时间", "date-range-group", "education[0].dateRange"],
      ["教育背景", 1, "学校名称", "suggest", "education[1].school"],
      ["教育背景", 1, "专业名称", "suggest", "education[1].major"],
      ["教育背景", 1, "学历", "select", "education[1].degree"],
      ["教育背景", 1, "起止时间", "date-range-group", "education[1].dateRange"],
      ["工作经历", 0, "公司名称", "text", "workExperiences[0].company"],
      ["工作经历", 0, "职位名称", "text", "workExperiences[0].title"],
      // 公司规模/公司性质不是公司名称，经历里的所在行业也不是求职意向里的行业
      ["工作经历", 0, "公司规模", "select", "信息库无此项"],
      ["工作经历", 0, "公司性质", "select", "信息库无此项"],
      ["工作经历", 0, "所在行业", "select", "信息库无此项"],
      ["工作经历", 0, "起止时间", "date-range-group", "workExperiences[0].dateRange"],
      ["工作经历", 0, "汇报对象", "text", "信息库无此项"],
      ["工作经历", 0, "离职原因", "textarea", "信息库无此项"],
      ["工作经历", 0, "工作职责", "textarea", "workExperiences[0].description"],
      ["实习经历", 0, "公司名称", "text", "internships[0].company"],
      ["实习经历", 0, "职位名称", "text", "internships[0].title"],
      ["实习经历", 0, "所在行业", "select", "信息库无此项"],
      ["实习经历", 0, "起止时间", "date-range-group", "internships[0].dateRange"],
      ["实习经历", 0, "工作职责", "textarea", "internships[0].description"],
      ["项目经验", 0, "项目名称", "text", "projects[0].name"],
      ["项目经验", 0, "职责", "text", "projects[0].role"],
      ["项目经验", 0, "起止时间", "date-range-group", "projects[0].dateRange"],
      ["项目经验", 0, "项目中职责", "textarea", "projects[0].description"],
      ["项目经验", 0, "项目描述", "textarea", "projects[0].description"],
      ["语言能力", 0, "语言类型", "select", "derived.languageType"],
      ["语言能力", 0, "听说能力", "select", "derived.languageListenSpeak"],
      ["语言能力", 0, "读写能力", "select", "derived.languageReadWrite"],
      ["自我描述", 0, "技能", "textarea", "skills.skills"],
      ["自我描述", 0, "兴趣爱好", "text", "skills.hobbies"],
      ["自我描述", 0, "自我描述", "textarea", "skills.selfEvaluation"],
      ["获奖经历", 0, "奖项名称", "text", "awards[0].name"],
      ["个人信息保护声明", 0, "声明确认", "confirm", "跳过"],
    ]);

    const byLabel = (label, section) =>
      diagnostics.fields.find((f) => f.label === label && (!section || f.sectionTitle === section));
    // 必填看 required-asterisk
    expect(byLabel("姓名").required).toBe(true);
    expect(byLabel("证件号码").required).toBe(false);
    expect(byLabel("附件简历").required).toBe(true);
    // 手机号码的号码框在 +86 小下拉后面，只认一个输入框
    expect(byLabel("手机号码").parts).toEqual({ input: true });
    // 起止时间：年、月、年、月 四个下拉；工作/实习的带"至今"，教育的没有
    const allParts = { startYear: true, startMonth: true, endYear: true, endMonth: true };
    expect(byLabel("起止时间", "工作经历").parts).toEqual({ ...allParts, isCurrent: true });
    expect(byLabel("起止时间", "教育背景").parts).toEqual({ ...allParts, isCurrent: false });
    expect(byLabel("毕业时间").parts).toEqual({ year: true, month: true });
    expect(diagnostics.fields.every((f) => f.kit === "moka")).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain('"value"');
  } finally {
    await context.close();
  }
});

test("Moka 仿真页：开始填写逐项填好、自动添加经历、检查清单、绝不点“预览并提交”、撤销后复原", async () => {
  test.setTimeout(180_000);
  const { context, extensionId } = await launchWithExtension();

  try {
    const { page, popup, initialState } = await fillViaPopup(context, extensionId, MOKA_PROFILE, MOKA_URL);
    await expect(popup.locator('[data-testid="status-text"]')).toHaveText("填写完成");

    // ---- 页面上每个控件显示的值 ----
    await expect(inputsOf(page, "full-name")).toHaveValue("李雷");
    expect(await shownOf(page, "phone")).toEqual(["+86", "13900139000"]);
    expect(await shownOf(page, "id-number")).toEqual(["身份证", "420102200105201234"]);
    expect(await shown(page, "gender")).toBe("男");
    // 下拉的 input.value 一直是空的，插件是从 display-value 回读的
    await expect(inputsOf(page, "gender")).toHaveValue("");
    await expect(inputsOf(page, "birth-date")).toHaveValue("2001-05-20");
    expect(await shown(page, "political-status")).toBe("中共预备党员");
    expect(await shown(page, "native-place")).toBe("湖北省/武汉市/洪山区");
    await expect(inputsOf(page, "native-place")).toHaveValue("");
    expect(await shown(page, "location")).toBe("广东省/深圳市");
    expect(await shown(page, "work-years")).toBe("应届毕业生");
    expect(await shown(page, "highest-degree")).toBe("硕士");
    await expect(inputsOf(page, "latest-major")).toHaveValue("软件工程");
    expect(await shownOf(page, "graduation")).toEqual(["2026", "6"]);
    expect(await valuesOf(page, "graduation")).toEqual(["", ""]);
    await expect(inputsOf(page, "current-title")).toHaveValue("后端工程师");
    await expect(inputsOf(page, "current-salary")).toHaveValue("");
    await expect(inputsOf(page, "referral-code")).toHaveValue("");
    expect(await shownOf(page, "resume-update")).toEqual(["", ""]);
    expect(await shown(page, "intention-city")).toBe("深圳");
    expect(await shown(page, "current-industry")).toBe("互联网");
    expect(await shownOf(page, "available")).toEqual(["2026", "7"]);
    await expect(inputsOf(page, "school-0")).toHaveValue("北京邮电大学（宏福校区）");
    await expect(inputsOf(page, "major-0")).toHaveValue("计算机科学与技术");
    await expect(inputsOf(page, "school-1")).toHaveValue("华中科技大学");
    expect(await shownOf(page, "education-range-0")).toEqual(["2019", "9", "2023", "6"]);
    expect(await shownOf(page, "education-range-1")).toEqual(["2023", "9", "2026", "6"]);
    // 工作经历"至今"：勾上，结束年月留空且禁用
    expect(await shownOf(page, "work-range-0")).toEqual(["2026", "7", "", ""]);
    await expect(field(page, "work-range-0").locator("input[type='checkbox']")).toBeChecked();
    await expect(inputsOf(page, "work-range-0").nth(2)).toBeDisabled();
    expect(await shownOf(page, "intern-range-0")).toEqual(["2022", "12", "2023", "3"]);
    await expect(field(page, "intern-range-0").locator("input[type='checkbox']")).not.toBeChecked();
    expect(await shownOf(page, "intern-range-1")).toEqual(["2024", "7", "2024", "10"]);
    expect(await shownOf(page, "project-range-0")).toEqual(["2025", "1", "", ""]);
    await expect(field(page, "project-range-0").locator("input[type='checkbox']")).toBeChecked();
    // 经历里的公司规模/公司性质/所在行业：信息库没有，不填
    expect(await shown(page, "work-company-size-0")).toBe("");
    expect(await shown(page, "work-company-nature-0")).toBe("");
    expect(await shown(page, "work-industry-0")).toBe("");
    expect(await shown(page, "intern-industry-0")).toBe("");
    expect(await shown(page, "language-type-0")).toBe("英语");
    expect(await shown(page, "language-listen-0")).toBe("良好");
    expect(await shown(page, "language-read-0")).toBe("熟练");
    await expect(inputsOf(page, "award-name-0")).toHaveValue("国家奖学金（2021）");
    await expect(inputsOf(page, "award-name-1")).toHaveValue("ACM 区域赛银牌");
    await expect(field(page, "confirm").locator("input[type='checkbox']")).not.toBeChecked();

    // ---- 组件内部的表单值真的更新了 ----
    const state = await page.evaluate(() => window.__fixture.snapshot());
    expect(state.basic).toEqual({
      ...initialState.basic,
      fullName: "李雷",
      phone: "13900139000",
      email: "lilei@example.com",
      gender: "男",
      birthDate: "2001-05-20",
      idNumber: "420102200105201234",
      politicalStatus: "中共预备党员",
      nation: "汉族",
      nativePlace: ["湖北省", "武汉市", "洪山区"],
      location: ["广东省", "深圳市"],
      workYears: "应届毕业生",
      highestDegree: "硕士",
      latestMajor: "软件工程",
      graduationYear: 2026,
      graduationMonth: 6,
      currentTitle: "后端工程师",
    });
    expect(state.intention).toEqual({
      city: "深圳",
      position: "后端开发工程师",
      currentIndustry: "互联网",
      expectedIndustry: "互联网",
      expectedSalary: "20-25K",
      availableYear: 2026,
      availableMonth: 7,
    });
    expect(state.education).toEqual([
      { school: "北京邮电大学（宏福校区）", major: "计算机科学与技术", degree: "本科", startYear: 2019, startMonth: 9, endYear: 2023, endMonth: 6 },
      { school: "华中科技大学", major: "软件工程", degree: "硕士", startYear: 2023, startMonth: 9, endYear: 2026, endMonth: 6 },
    ]);
    expect(state.work).toEqual([
      {
        company: "速通科技",
        title: "后端工程师",
        companySize: null,
        companyNature: null,
        industry: null,
        startYear: 2026,
        startMonth: 7,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        reportTo: "",
        leaveReason: "",
        description: "负责网申系统后端",
      },
    ]);
    expect(state.internships).toEqual([
      { company: "字节跳动", title: "后端开发实习生", industry: null, startYear: 2022, startMonth: 12, endYear: 2023, endMonth: 3, isCurrent: false, description: "负责推荐系统接口开发" },
      { company: "腾讯", title: "算法实习生", industry: null, startYear: 2024, startMonth: 7, endYear: 2024, endMonth: 10, isCurrent: false, description: "参与广告召回模型优化" },
    ]);
    // 项目的"职责"是项目角色，"项目中职责""项目描述"都填项目描述
    expect(state.projects).toEqual([
      {
        name: "简历速通",
        role: "负责人",
        startYear: 2025,
        startMonth: 1,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        duty: "浏览器插件，一键填写网申表单",
        description: "浏览器插件，一键填写网申表单",
      },
    ]);
    expect(state.languages).toEqual([{ language: "英语", listenSpeak: "良好", readWrite: "熟练" }]);
    expect(state.awards).toEqual([{ name: "国家奖学金（2021）" }, { name: "ACM 区域赛银牌" }]);
    expect(state.other).toEqual({
      skills: "Java、Go、MySQL",
      hobbies: "跑步、摄影",
      selfDescription: "踏实肯干，喜欢钻研",
      agreed: false,
    });
    expect(state.submitted).toBe(false);

    // 教育 1 -> 2 段、实习 1 -> 2 段、项目 0 -> 1 段、获奖 1 -> 2 段都是插件点"添加"加出来的；
    // 工作经历本来就够，语言能力不按段数补
    const counters = await page.evaluate(() => window.__fixture.counters);
    expect(counters.addClicks).toEqual({ education: 1, work: 0, internship: 1, project: 1, language: 0, award: 1 });
    expect(counters.deleteClicks).toEqual({ education: 0, work: 0, internship: 0, project: 0, language: 0, award: 0 });
    // 联想输入都是点选候选项选中的；联想里没有的学校名没有乱点
    expect(counters.suggestPicks.sort()).toEqual(["华中科技大学", "计算机科学与技术", "软件工程", "软件工程"].sort());
    // "预览并提交"一次都没被点过
    expect(counters.submitClicks).toBe(0);
    await expect(page.locator('[data-fixture="submitted-marker"]')).toHaveCount(0);

    // ---- 检查清单 ----
    const panel = page.locator('[data-role="review-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-count="filled"]')).toHaveText("已填 49");
    await expect(panel.locator('[data-count="needs-confirmation"]')).toHaveText("需确认 5");
    await expect(panel.locator('[data-count="skipped"]')).toHaveText("未填 13");
    await expect(panel.locator('[data-role="required-warning"]')).toContainText("2 个必填项");
    const items = panel.locator('[data-role="items"] li');
    // 必填但插件不碰的"附件简历""声明确认"置顶
    await expect(items.nth(0)).toContainText("附件简历");
    await expect(items.nth(0)).toContainText("自己上传");
    await expect(items.nth(1)).toContainText("声明确认");
    const item = (text) => panel.locator("li", { hasText: text });
    await expect(item("意向工作城市")).toHaveAttribute("data-status", "needs-confirmation");
    await expect(item("意向工作城市")).toContainText("只能选一个，选了第一个");
    await expect(item("教育背景 第 1 段 · 学校名称")).toHaveAttribute("data-status", "needs-confirmation");
    await expect(item("教育背景 第 1 段 · 学校名称")).toContainText("保留了输入的文字");
    await expect(item("教育背景 第 1 段 · 专业名称")).toHaveAttribute("data-status", "needs-confirmation");
    await expect(item("教育背景 第 1 段 · 专业名称")).toContainText("选了最接近的「计算机科学与技术」");
    // 听说/读写是按英语等级推断的，要用户确认
    for (const label of ["语言能力 第 1 段 · 听说能力", "语言能力 第 1 段 · 读写能力"]) {
      await expect(item(label)).toHaveAttribute("data-status", "needs-confirmation");
      await expect(item(label)).toContainText("CET-6");
    }
    await expect(item("语言能力 第 1 段 · 语言类型")).toHaveAttribute("data-status", "filled");
    for (const label of [
      "推荐码",
      "简历更新时间",
      "工作经历 第 1 段 · 汇报对象",
      "工作经历 第 1 段 · 离职原因",
      "工作经历 第 1 段 · 公司规模",
      "工作经历 第 1 段 · 公司性质",
      "工作经历 第 1 段 · 所在行业",
      "实习经历 第 1 段 · 所在行业",
    ]) {
      await expect(item(label)).toHaveAttribute("data-status", "skipped");
      await expect(item(label)).toContainText("信息库无此项");
    }
    await expect(item("当前薪资")).toContainText("简历里这一项是空的");
    await expect(item("工作经历 第 1 段 · 起止时间")).toContainText("2026-07 ~ 至今");
    for (const label of ["性别", "籍贯", "所在地", "出生日期", "毕业时间", "获奖经历 第 2 段 · 奖项名称"]) {
      await expect(item(label)).toHaveAttribute("data-status", "filled");
    }
    await expect(panel.locator('li[data-status="failed"]')).toHaveCount(0);
    await expect(panel.locator('[data-role="draft-notice"]')).toContainText(
      "Moka 会自动保存草稿，撤销后如仍有残留可刷新页面检查"
    );

    // 用户填完后自己改了插件加出来的第 2 条获奖：撤销时这一段不能删
    await inputsOf(page, "award-name-1").fill("ACM 区域赛银牌（手动修改）");

    // ---- 撤销 ----
    await panel.locator('[data-action="undo"]').click();
    await expect(panel.locator('[data-role="undo-notice"]')).toBeVisible({ timeout: 120_000 });

    const undone = await page.evaluate(() => window.__fixture.snapshot());
    // 下拉、年月、地区、出生日期都清回空；插件自己加出来、没被改过的段都删掉了；
    // 性别下拉没有清空按钮，只能请用户手动清空；用户改过的第 2 条获奖原样保留。
    expect(undone).toEqual({
      ...initialState,
      basic: { ...initialState.basic, gender: "男" },
      awards: [initialState.awards[0], { name: "ACM 区域赛银牌（手动修改）" }],
    });
    const after = await page.evaluate(() => window.__fixture.counters);
    expect(after.deleteClicks).toEqual({ education: 1, work: 0, internship: 1, project: 1, language: 0, award: 0 });
    expect(after.submitClicks).toBe(0);
    for (const id of ["political-status", "native-place", "location", "intention-city", "language-type-0"]) {
      expect(await shown(page, id)).toBe("");
    }
    await expect(inputsOf(page, "birth-date")).toHaveValue("");
    // 用户原来就有的段一个都没删
    await expect(field(page, "school-0")).toBeVisible();
    await expect(field(page, "intern-company-0")).toBeVisible();
    await expect(field(page, "work-company-0")).toBeVisible();
    await expect(field(page, "award-name-0")).toBeVisible();
    await expect(field(page, "school-1")).toHaveCount(0);
    await expect(field(page, "project-name-0")).toHaveCount(0);

    await expect(panel.locator('[data-count="undo-failed"]')).toHaveText("没能还原 2");
    const undoItems = panel.locator('[data-role="items"] li');
    await expect(undoItems).toHaveCount(2);
    await expect(undoItems.filter({ hasText: "性别" })).toContainText("该项需手动清空");
    await expect(undoItems.filter({ hasText: "获奖经历 第 2 段" })).toContainText("改动过");
    await expect(panel.locator('[data-role="undo-notice"]')).toContainText("已删除");
    await expect(panel.locator('[data-role="draft-notice"]')).toContainText("刷新页面检查");
  } finally {
    await context.close();
  }
});
