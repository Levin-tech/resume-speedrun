// Moka 仿真页（test/fixtures/moka，照 2026-09 实测的 app.mokahr.com 结构复刻）端到端测试：
// 扫描识别、逐项填写（下拉、年月、至今、籍贯、出生日期、联想输入）、自动添加经历、
// 检查清单、"预览并提交"一次都没被点、撤销后复原。
import { test, expect } from "@playwright/test";
import { launchWithExtension, fillViaPopup, scanDiagnostics } from "./helpers.js";
import { MOKA_PROFILE } from "./moka-profile.js";

const MOKA_URL = "http://127.0.0.1:4173/moka/";

const field = (page, id) => page.locator(`[data-fixture="${id}"]`);
const inputsOf = (page, id) => field(page, id).locator("input:not([type='checkbox'])");
const valuesOf = (page, id) => inputsOf(page, id).evaluateAll((els) => els.map((el) => el.value));

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
    expect(classes[0]).toMatch(/^apply-field-\w+ Select$/);
    expect(classes[1]).toMatch(/^sd-Input-input-\w+$/);

    // 只派发 click 打不开；按实测顺序 pointerdown -> mousedown -> focus -> mouseup -> click 才打开。
    const gender = inputsOf(page, "gender");
    await gender.evaluate((el) => el.click());
    await expect(field(page, "gender").locator('[class*="sd-Dropdown-dropdown"]')).toHaveCount(0);
    await gender.dispatchEvent("mousedown");
    await expect(field(page, "gender").locator('[class*="sd-Menu-content-item"]')).toHaveText(["男", "女"]);
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
      ["工作经历", 0, "起止时间", "date-range-group", "workExperiences[0].dateRange"],
      ["工作经历", 0, "汇报对象", "text", "信息库无此项"],
      ["工作经历", 0, "离职原因", "textarea", "信息库无此项"],
      ["工作经历", 0, "工作描述", "textarea", "workExperiences[0].description"],
      ["实习经历", 0, "公司名称", "text", "internships[0].company"],
      ["实习经历", 0, "职位名称", "text", "internships[0].title"],
      ["实习经历", 0, "起止时间", "date-range-group", "internships[0].dateRange"],
      ["实习经历", 0, "实习描述", "textarea", "internships[0].description"],
      ["语言能力", 0, "语言能力", "textarea", "derived.languageAbility"],
      ["自我描述", 0, "技能", "textarea", "skills.skills"],
      ["自我描述", 0, "兴趣爱好", "text", "skills.hobbies"],
      ["自我描述", 0, "自我描述", "textarea", "skills.selfEvaluation"],
      ["获奖经历", 0, "获奖经历", "textarea", "skills.awards"],
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
    expect(await valuesOf(page, "phone")).toEqual(["+86", "13900139000"]);
    expect(await valuesOf(page, "id-number")).toEqual(["身份证", "420102200105201234"]);
    await expect(inputsOf(page, "gender")).toHaveValue("男");
    await expect(inputsOf(page, "birth-date")).toHaveValue("2001-05-20");
    await expect(inputsOf(page, "political-status")).toHaveValue("中共预备党员");
    await expect(inputsOf(page, "native-place")).toHaveValue("湖北省/武汉市/洪山区");
    await expect(inputsOf(page, "location")).toHaveValue("广东省/深圳市");
    await expect(inputsOf(page, "work-years")).toHaveValue("应届毕业生");
    await expect(inputsOf(page, "highest-degree")).toHaveValue("硕士");
    await expect(inputsOf(page, "latest-major")).toHaveValue("软件工程");
    expect(await valuesOf(page, "graduation")).toEqual(["2026", "6"]);
    await expect(inputsOf(page, "current-title")).toHaveValue("后端工程师");
    await expect(inputsOf(page, "current-salary")).toHaveValue("");
    await expect(inputsOf(page, "referral-code")).toHaveValue("");
    expect(await valuesOf(page, "resume-update")).toEqual(["", ""]);
    await expect(inputsOf(page, "intention-city")).toHaveValue("深圳");
    await expect(inputsOf(page, "current-industry")).toHaveValue("互联网");
    expect(await valuesOf(page, "available")).toEqual(["2026", "7"]);
    await expect(inputsOf(page, "school-0")).toHaveValue("北京邮电大学（宏福校区）");
    await expect(inputsOf(page, "major-0")).toHaveValue("计算机科学与技术");
    await expect(inputsOf(page, "school-1")).toHaveValue("华中科技大学");
    expect(await valuesOf(page, "education-range-0")).toEqual(["2019", "9", "2023", "6"]);
    expect(await valuesOf(page, "education-range-1")).toEqual(["2023", "9", "2026", "6"]);
    // 工作经历"至今"：勾上，结束年月留空且禁用
    expect(await valuesOf(page, "work-range-0")).toEqual(["2026", "7", "", ""]);
    await expect(field(page, "work-range-0").locator("input[type='checkbox']")).toBeChecked();
    await expect(inputsOf(page, "work-range-0").nth(2)).toBeDisabled();
    expect(await valuesOf(page, "intern-range-0")).toEqual(["2022", "12", "2023", "3"]);
    await expect(field(page, "intern-range-0").locator("input[type='checkbox']")).not.toBeChecked();
    expect(await valuesOf(page, "intern-range-1")).toEqual(["2024", "7", "2024", "10"]);
    expect(await valuesOf(page, "project-range-0")).toEqual(["2025", "1", "", ""]);
    await expect(field(page, "project-range-0").locator("input[type='checkbox']")).toBeChecked();
    await expect(field(page, "awards").locator("textarea")).toHaveValue("国家奖学金（2021）\nACM 区域赛银牌");
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
      { company: "字节跳动", title: "后端开发实习生", startYear: 2022, startMonth: 12, endYear: 2023, endMonth: 3, isCurrent: false, description: "负责推荐系统接口开发" },
      { company: "腾讯", title: "算法实习生", startYear: 2024, startMonth: 7, endYear: 2024, endMonth: 10, isCurrent: false, description: "参与广告召回模型优化" },
    ]);
    expect(state.projects).toEqual([
      { name: "简历速通", role: "负责人", startYear: 2025, startMonth: 1, endYear: null, endMonth: null, isCurrent: true, description: "浏览器插件，一键填写网申表单" },
    ]);
    expect(state.other).toEqual({
      languageAbility: "英语 CET-6",
      skills: "Java、Go、MySQL",
      hobbies: "跑步、摄影",
      selfDescription: "踏实肯干，喜欢钻研",
      awards: "国家奖学金（2021）\nACM 区域赛银牌",
      agreed: false,
    });
    expect(state.submitted).toBe(false);

    // 教育 1 -> 2 段、实习 1 -> 2 段、项目 0 -> 1 段都是插件点"添加"加出来的；工作经历本来就够
    const counters = await page.evaluate(() => window.__fixture.counters);
    expect(counters.addClicks).toEqual({ education: 1, work: 0, internship: 1, project: 1 });
    // 联想输入都是点选候选项选中的；联想里没有的学校名没有乱点
    expect(counters.suggestPicks.sort()).toEqual(["华中科技大学", "计算机科学与技术", "软件工程", "软件工程"].sort());
    // "预览并提交"一次都没被点过
    expect(counters.submitClicks).toBe(0);
    await expect(page.locator('[data-fixture="submitted-marker"]')).toHaveCount(0);

    // ---- 检查清单 ----
    const panel = page.locator('[data-role="review-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-count="filled"]')).toHaveText("已填 47");
    await expect(panel.locator('[data-count="needs-confirmation"]')).toHaveText("需确认 3");
    await expect(panel.locator('[data-count="skipped"]')).toHaveText("未填 8");
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
    for (const label of ["推荐码", "简历更新时间", "工作经历 第 1 段 · 汇报对象", "工作经历 第 1 段 · 离职原因"]) {
      await expect(item(label)).toHaveAttribute("data-status", "skipped");
      await expect(item(label)).toContainText("信息库无此项");
    }
    await expect(item("当前薪资")).toContainText("简历里这一项是空的");
    await expect(item("工作经历 第 1 段 · 起止时间")).toContainText("2026-07 ~ 至今");
    await expect(item("籍贯")).toHaveAttribute("data-status", "filled");
    await expect(item("出生日期")).toHaveAttribute("data-status", "filled");
    await expect(panel.locator('li[data-status="failed"]')).toHaveCount(0);

    // ---- 撤销 ----
    await panel.locator('[data-action="undo"]').click();
    await expect(panel.locator('[data-role="undo-notice"]')).toBeVisible({ timeout: 120_000 });
    await expect(panel.locator('[data-count="undo-failed"]')).toHaveText("没能还原 0");

    const undone = await page.evaluate(() => window.__fixture.snapshot());
    const blankProject = {
      name: "",
      role: "",
      startYear: null,
      startMonth: null,
      endYear: null,
      endMonth: null,
      isCurrent: false,
      description: "",
    };
    // 所有填过的项都恢复原样；插件加出来的经历区块保留为空白（插件不点删除）
    expect(undone).toEqual({
      ...initialState,
      education: [initialState.education[0], initialState.education[0]],
      internships: [initialState.internships[0], initialState.internships[0]],
      projects: [blankProject],
    });
    expect((await page.evaluate(() => window.__fixture.counters)).submitClicks).toBe(0);
  } finally {
    await context.close();
  }
});
