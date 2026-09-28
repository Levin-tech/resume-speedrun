// Moka 网申页仿真：div.apply-blocks > div.apply-block（区块）> [class*=blockTitle]
// > div.apply-fields（一段经历）> div.apply-field（一个字段，第二个类名是字段类型）。
// 字段类型、组件类名、浮层位置都照实测的 Moka 页面复刻，见 docs/platforms/moka.md。
import { defineComponent, h, reactive } from "vue";
import { cx, SdInput, SdTextarea, SdSelect, SdSuggest, SdCheckbox, SdDayPicker, SdLocation, SdUpload } from "./sd.js";
import {
  GENDER_OPTIONS,
  POLITICAL_STATUS_OPTIONS,
  NATION_OPTIONS,
  WORK_YEARS_OPTIONS,
  HIGHEST_DEGREE_OPTIONS,
  DEGREE_OPTIONS,
  CITY_OPTIONS,
  INDUSTRY_OPTIONS,
  PHONE_CODE_OPTIONS,
  ID_TYPE_OPTIONS,
  YEAR_OPTIONS,
  MONTH_OPTIONS,
  SCHOOL_CANDIDATES,
  MAJOR_CANDIDATES,
  REGIONS,
  HOT_CITIES,
  createEducationEntry,
  createWorkEntry,
  createInternshipEntry,
  createProjectEntry,
} from "./data.js";

function field({ type, label, required = false, fullWidth = false, id }, content) {
  return h("div", { class: [cx("apply-field"), type, fullWidth && "full-width-field"], "data-fixture": id }, [
    h("div", { class: cx("field-title") }, [required ? h("span", { class: cx("required-asterisk") }, "*") : null, label]),
    h("div", { class: cx("field-content") }, [content]),
  ]);
}

function block({ key, title, onAdd }, groups) {
  return h("div", { class: "apply-block", "data-fixture": `block-${key}` }, [
    h("div", { class: cx("blockTitle") }, [
      h("span", { class: cx("blockName") }, title),
      onAdd
        ? h("div", { class: cx("blockAdd"), onClick: onAdd, "data-fixture": `add-${key}` }, [
            h("span", { class: cx("icon-plus") }, "+"),
            h("span", null, "添加"),
          ])
        : null,
    ]),
    ...groups.map((fields, index) => h("div", { class: "apply-fields", key: index }, fields)),
  ]);
}

const bind = (obj, key) => ({ value: obj[key], "onUpdate:value": (v) => (obj[key] = v) });

function text(obj, key) {
  return h(SdInput, bind(obj, key));
}

function textarea(obj, key) {
  return h(SdTextarea, bind(obj, key));
}

function select(obj, key, options, extra = {}) {
  return h(SdSelect, { ...bind(obj, key), options, ...extra });
}

function yearSelect(obj, key, disabled = false) {
  return select(obj, key, YEAR_OPTIONS, { placeholder: "年", filterable: true, disabled, width: "96px" });
}

function monthSelect(obj, key, disabled = false) {
  return select(obj, key, MONTH_OPTIONS, { placeholder: "月", disabled, width: "80px" });
}

/** date_info：年、月两个下拉。 */
function yearMonth(obj, yearKey, monthKey) {
  return h("div", { class: cx("date-info") }, [yearSelect(obj, yearKey), monthSelect(obj, monthKey)]);
}

/** 带 full-width-field 的 date_info：年、月 — 年、月，工作/实习/项目的带"至今"。 */
function dateRange(entry, { withCurrent }) {
  return h("div", { class: cx("date-info") }, [
    yearSelect(entry, "startYear"),
    monthSelect(entry, "startMonth"),
    h("span", { class: cx("date-sep") }, "至"),
    yearSelect(entry, "endYear", entry.isCurrent),
    monthSelect(entry, "endMonth", entry.isCurrent),
    withCurrent
      ? h(SdCheckbox, {
          checked: entry.isCurrent,
          label: "至今",
          "onUpdate:checked": (checked) => {
            entry.isCurrent = checked;
            if (checked) {
              entry.endYear = null;
              entry.endMonth = null;
            }
          },
        })
      : null,
  ]);
}

/** 手机号码/证件号码：前面一个小下拉（+86、身份证），号码填在后面的输入框。 */
function withPrefix(obj, prefixKey, prefixOptions, key) {
  return h("div", { class: cx("sd-Input-group") }, [
    select(obj, prefixKey, prefixOptions, { width: "90px" }),
    text(obj, key),
  ]);
}

function suggest(obj, key, candidates, counters) {
  return h(SdSuggest, {
    ...bind(obj, key),
    candidates,
    onPick: (label) => counters.suggestPicks.push(label),
  });
}

function location(obj, key) {
  return h(SdLocation, { ...bind(obj, key), regions: REGIONS, hot: HOT_CITIES });
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export default defineComponent({
  name: "MokaApp",
  setup() {
    const state = reactive({
      basic: {
        fullName: "",
        phoneCode: "+86",
        phone: "",
        email: "",
        gender: null,
        birthDate: "",
        idType: "身份证",
        idNumber: "",
        politicalStatus: null,
        nation: null,
        nativePlace: [],
        location: [],
        workYears: null,
        highestDegree: null,
        latestMajor: "",
        graduationYear: null,
        graduationMonth: null,
        currentTitle: "",
        currentSalary: "",
        referralCode: "",
        resumeUpdateYear: null,
        resumeUpdateMonth: null,
      },
      intention: {
        city: null,
        position: "",
        currentIndustry: null,
        expectedIndustry: null,
        expectedSalary: "",
        availableYear: null,
        availableMonth: null,
      },
      education: [createEducationEntry()],
      work: [createWorkEntry()],
      internships: [createInternshipEntry()],
      projects: [],
      other: { languageAbility: "", skills: "", hobbies: "", selfDescription: "", awards: "", agreed: false },
      submitted: false,
    });

    // 给 Playwright 读"组件内部的表单值"和按钮点击次数；插件的内容脚本运行在
    // 独立的 JS 世界，看不到这个对象。
    const counters = {
      submitClicks: 0,
      addClicks: { education: 0, work: 0, internship: 0, project: 0 },
      suggestPicks: [],
    };
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest?.('[data-fixture="submit"]')) counters.submitClicks += 1;
      },
      true
    );
    window.__fixture = { counters, snapshot: () => toPlain(state) };

    const adder = (key, list, create) => () => {
      counters.addClicks[key] += 1;
      list.push(create());
    };

    const basic = state.basic;
    const intention = state.intention;
    const other = state.other;

    return () =>
      h("div", { class: cx("apply-page") }, [
        h("h1", "Moka 网申页仿真（sd- 组件）"),
        h("div", { class: "apply-blocks" }, [
          block({ key: "basic", title: "个人信息" }, [
            [
              field({ type: "attachment_upload", label: "附件简历", required: true, id: "attachment" }, h(SdUpload, { text: "上传附件简历" })),
              field({ type: "file_upload", label: "照片", id: "photo" }, h(SdUpload, { text: "上传照片" })),
              field({ type: "string_info", label: "姓名", required: true, id: "full-name" }, text(basic, "fullName")),
              field(
                { type: "string_info", label: "手机号码", required: true, id: "phone" },
                withPrefix(basic, "phoneCode", PHONE_CODE_OPTIONS, "phone")
              ),
              field({ type: "string_info", label: "邮箱", required: true, id: "email" }, text(basic, "email")),
              field({ type: "Select", label: "性别", required: true, id: "gender" }, select(basic, "gender", GENDER_OPTIONS)),
              field(
                { type: "day_info", label: "出生日期", required: true, id: "birth-date" },
                h(SdDayPicker, { ...bind(basic, "birthDate"), minYear: 1950, maxYear: 2026 })
              ),
              field(
                { type: "string_info", label: "证件号码", id: "id-number" },
                withPrefix(basic, "idType", ID_TYPE_OPTIONS, "idNumber")
              ),
              field(
                { type: "Select", label: "政治面貌", id: "political-status" },
                select(basic, "politicalStatus", POLITICAL_STATUS_OPTIONS)
              ),
              field({ type: "Select", label: "民族", id: "nation" }, select(basic, "nation", NATION_OPTIONS)),
              field({ type: "location_info", label: "籍贯", id: "native-place" }, location(basic, "nativePlace")),
              field({ type: "location_info", label: "所在地", id: "location" }, location(basic, "location")),
              field({ type: "Select", label: "工作经验", id: "work-years" }, select(basic, "workYears", WORK_YEARS_OPTIONS)),
              field(
                { type: "Select", label: "最高学历", required: true, id: "highest-degree" },
                select(basic, "highestDegree", HIGHEST_DEGREE_OPTIONS)
              ),
              field(
                { type: "string_info", label: "最近毕业专业", id: "latest-major" },
                suggest(basic, "latestMajor", MAJOR_CANDIDATES, counters)
              ),
              field(
                { type: "date_info", label: "毕业时间", id: "graduation" },
                yearMonth(basic, "graduationYear", "graduationMonth")
              ),
              field({ type: "string_info", label: "目前职位", id: "current-title" }, text(basic, "currentTitle")),
              field({ type: "string_info", label: "当前薪资", id: "current-salary" }, text(basic, "currentSalary")),
              field({ type: "string_info", label: "推荐码", id: "referral-code" }, text(basic, "referralCode")),
              field(
                { type: "date_info", label: "简历更新时间", id: "resume-update" },
                yearMonth(basic, "resumeUpdateYear", "resumeUpdateMonth")
              ),
            ],
          ]),

          block({ key: "intention", title: "求职意向" }, [
            [
              field(
                { type: "Select", label: "意向工作城市", required: true, id: "intention-city" },
                select(intention, "city", CITY_OPTIONS)
              ),
              field({ type: "string_info", label: "期望职位", id: "position" }, text(intention, "position")),
              field(
                { type: "Select", label: "所在行业", id: "current-industry" },
                select(intention, "currentIndustry", INDUSTRY_OPTIONS)
              ),
              field(
                { type: "Select", label: "期望行业", id: "expected-industry" },
                select(intention, "expectedIndustry", INDUSTRY_OPTIONS)
              ),
              field({ type: "string_info", label: "期望薪资", id: "expected-salary" }, text(intention, "expectedSalary")),
              field(
                { type: "date_info", label: "到岗时间", id: "available" },
                yearMonth(intention, "availableYear", "availableMonth")
              ),
            ],
          ]),

          block(
            { key: "education", title: "教育背景", onAdd: adder("education", state.education, createEducationEntry) },
            state.education.map((entry, i) => [
              field(
                { type: "string_info", label: "学校名称", required: true, id: `school-${i}` },
                suggest(entry, "school", SCHOOL_CANDIDATES, counters)
              ),
              field(
                { type: "string_info", label: "专业名称", required: true, id: `major-${i}` },
                suggest(entry, "major", MAJOR_CANDIDATES, counters)
              ),
              field({ type: "Select", label: "学历", required: true, id: `degree-${i}` }, select(entry, "degree", DEGREE_OPTIONS)),
              field(
                { type: "date_info", label: "起止时间", required: true, fullWidth: true, id: `education-range-${i}` },
                dateRange(entry, { withCurrent: false })
              ),
            ])
          ),

          block(
            { key: "work", title: "工作经历", onAdd: adder("work", state.work, createWorkEntry) },
            state.work.map((entry, i) => [
              field({ type: "string_info", label: "公司名称", id: `work-company-${i}` }, text(entry, "company")),
              field({ type: "string_info", label: "职位名称", id: `work-title-${i}` }, text(entry, "title")),
              field(
                { type: "date_info", label: "起止时间", fullWidth: true, id: `work-range-${i}` },
                dateRange(entry, { withCurrent: true })
              ),
              field({ type: "string_info", label: "汇报对象", id: `work-report-to-${i}` }, text(entry, "reportTo")),
              field({ type: "text_info", label: "离职原因", id: `work-leave-reason-${i}` }, textarea(entry, "leaveReason")),
              field({ type: "text_info", label: "工作描述", id: `work-description-${i}` }, textarea(entry, "description")),
            ])
          ),

          block(
            { key: "internship", title: "实习经历", onAdd: adder("internship", state.internships, createInternshipEntry) },
            state.internships.map((entry, i) => [
              field({ type: "string_info", label: "公司名称", id: `intern-company-${i}` }, text(entry, "company")),
              field({ type: "string_info", label: "职位名称", id: `intern-title-${i}` }, text(entry, "title")),
              field(
                { type: "date_info", label: "起止时间", fullWidth: true, id: `intern-range-${i}` },
                dateRange(entry, { withCurrent: true })
              ),
              field({ type: "text_info", label: "实习描述", id: `intern-description-${i}` }, textarea(entry, "description")),
            ])
          ),

          // 项目经验一开始一段都没有，只有"添加"按钮。
          block(
            { key: "project", title: "项目经验", onAdd: adder("project", state.projects, createProjectEntry) },
            state.projects.map((entry, i) => [
              field({ type: "string_info", label: "项目名称", id: `project-name-${i}` }, text(entry, "name")),
              field({ type: "string_info", label: "项目角色", id: `project-role-${i}` }, text(entry, "role")),
              field(
                { type: "date_info", label: "起止时间", fullWidth: true, id: `project-range-${i}` },
                dateRange(entry, { withCurrent: true })
              ),
              field({ type: "text_info", label: "项目描述", id: `project-description-${i}` }, textarea(entry, "description")),
            ])
          ),

          block({ key: "language", title: "语言能力" }, [
            [field({ type: "text_info", label: "语言能力", id: "language" }, textarea(other, "languageAbility"))],
          ]),

          block({ key: "self", title: "自我描述" }, [
            [
              field({ type: "text_info", label: "技能", id: "skills" }, textarea(other, "skills")),
              field({ type: "string_info", label: "兴趣爱好", id: "hobbies" }, text(other, "hobbies")),
              field({ type: "text_info", label: "自我描述", id: "self-description" }, textarea(other, "selfDescription")),
            ],
          ]),

          block({ key: "awards", title: "获奖经历" }, [
            [field({ type: "text_info", label: "获奖经历", id: "awards" }, textarea(other, "awards"))],
          ]),

          block({ key: "statement", title: "个人信息保护声明" }, [
            [
              field(
                { type: "confirm_info", label: "声明确认", required: true, id: "confirm" },
                h(SdCheckbox, {
                  checked: other.agreed,
                  label: "我已阅读并同意《候选人个人信息保护声明》",
                  "onUpdate:checked": (v) => (other.agreed = v),
                })
              ),
            ],
          ]),
        ]),
        h(
          "button",
          {
            type: "button",
            class: [cx("sd-Button-button"), cx("sd-Button-primary")],
            "data-fixture": "submit",
            onClick: () => (state.submitted = true),
          },
          "预览并提交"
        ),
        state.submitted ? h("p", { "data-fixture": "submitted-marker" }, "已提交（仅测试标记）") : null,
      ]);
  },
});
