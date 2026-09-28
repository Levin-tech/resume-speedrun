import { defineComponent, h, reactive, watch, computed } from "vue";
import {
  Button,
  Card,
  Collapse,
  Input,
  Select,
  DatePicker,
  Upload,
  Row,
  Col,
  message,
} from "ant-design-vue";
import {
  getResumeProfiles,
  saveResumeProfiles,
  getActiveProfileId,
  setActiveProfileId,
} from "../shared/storage/storage.js";
import {
  createEmptyResumeProfile,
  createEmptyEducationEntry,
  createEmptyInternshipEntry,
  createEmptyWorkEntry,
  createEmptyProjectEntry,
  migrateResumeProfile,
  parseImportedProfiles,
  buildExportPayload,
  createLocalId,
} from "../shared/schema/resume.js";
import {
  GENDER,
  DEGREE,
  DEGREE_MODE,
  SCHOOL_TIER,
  ID_TYPE,
  POLITICAL_STATUS,
  ENGLISH_LEVEL,
  NATION,
  INDUSTRY,
  WORK_YEARS,
} from "../shared/options-data/standard-values.js";

const CollapsePanel = Collapse.Panel;
const TextArea = Input.TextArea;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR + 5 - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function toSelectOptions(values) {
  return values.map((v) => ({ label: String(v), value: v }));
}

function numberOptions(arr) {
  return arr.map((v) => ({ label: String(v), value: v }));
}

function textField(label, testId, value, onInput, col = 12) {
  return h(Col, { span: col }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h(Input, {
        class: "field-control",
        value,
        "data-testid": `input-${testId}`,
        "onUpdate:value": onInput,
      }),
    ])
  );
}

function textAreaField(label, testId, value, onInput) {
  return h(Col, { span: 24 }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h(TextArea, {
        class: "field-control",
        value,
        rows: 3,
        "data-testid": `input-${testId}`,
        "onUpdate:value": onInput,
      }),
    ])
  );
}

function selectField(label, testId, value, onInput, choices, placeholder = "请选择", col = 12) {
  return h(Col, { span: col }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h(Select, {
        class: "field-control field-select",
        "data-testid": `select-${testId}`,
        value: value || undefined,
        options: toSelectOptions(choices),
        placeholder,
        allowClear: true,
        "onUpdate:value": (v) => onInput(v ?? ""),
      }),
    ])
  );
}

function yearMonthField(label, testId, ym, onChange) {
  return h(Col, { span: 12 }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h("div", { class: "field-control date-inline" }, [
        h(Select, {
          style: { width: "100px" },
          "data-testid": `select-${testId}-year`,
          value: ym.year ?? undefined,
          options: numberOptions(YEARS),
          placeholder: "年",
          allowClear: true,
          "onUpdate:value": (v) => onChange({ ...ym, year: v ?? null }),
        }),
        h(Select, {
          style: { width: "80px" },
          "data-testid": `select-${testId}-month`,
          value: ym.month ?? undefined,
          options: numberOptions(MONTHS),
          placeholder: "月",
          allowClear: true,
          "onUpdate:value": (v) => onChange({ ...ym, month: v ?? null }),
        }),
      ]),
    ])
  );
}

function fullDateField(label, testId, fd, onChange) {
  return h(Col, { span: 12 }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h("div", { class: "field-control date-inline" }, [
        h(Select, {
          style: { width: "100px" },
          "data-testid": `select-${testId}-year`,
          value: fd.year ?? undefined,
          options: numberOptions(YEARS),
          placeholder: "年",
          allowClear: true,
          "onUpdate:value": (v) => onChange({ ...fd, year: v ?? null }),
        }),
        h(Select, {
          style: { width: "80px" },
          "data-testid": `select-${testId}-month`,
          value: fd.month ?? undefined,
          options: numberOptions(MONTHS),
          placeholder: "月",
          allowClear: true,
          "onUpdate:value": (v) => onChange({ ...fd, month: v ?? null }),
        }),
        h(Select, {
          style: { width: "80px" },
          "data-testid": `select-${testId}-day`,
          value: fd.day ?? undefined,
          options: numberOptions(DAYS),
          placeholder: "日",
          allowClear: true,
          "onUpdate:value": (v) => onChange({ ...fd, day: v ?? null }),
        }),
      ]),
    ])
  );
}

function dateRangeField(label, testId, entry, onChange) {
  return h(Col, { span: 24 }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}-range` }, [
      h("label", { class: "field-label" }, label),
      h("div", { class: "field-control date-inline" }, [
        h(Select, {
          style: { width: "100px" },
          "data-testid": `select-${testId}-start-year`,
          value: entry.startDate.year ?? undefined,
          options: numberOptions(YEARS),
          placeholder: "起始年",
          allowClear: true,
          "onUpdate:value": (v) =>
            onChange("startDate", { ...entry.startDate, year: v ?? null }),
        }),
        h(Select, {
          style: { width: "80px" },
          "data-testid": `select-${testId}-start-month`,
          value: entry.startDate.month ?? undefined,
          options: numberOptions(MONTHS),
          placeholder: "月",
          allowClear: true,
          "onUpdate:value": (v) =>
            onChange("startDate", { ...entry.startDate, month: v ?? null }),
        }),
        h("span", { class: "date-range-sep" }, "—"),
        h(Select, {
          style: { width: "100px" },
          "data-testid": `select-${testId}-end-year`,
          disabled: entry.isCurrent,
          value: entry.endDate.year ?? undefined,
          options: numberOptions(YEARS),
          placeholder: "结束年",
          allowClear: true,
          "onUpdate:value": (v) =>
            onChange("endDate", { ...entry.endDate, year: v ?? null }),
        }),
        h(Select, {
          style: { width: "80px" },
          "data-testid": `select-${testId}-end-month`,
          disabled: entry.isCurrent,
          value: entry.endDate.month ?? undefined,
          options: numberOptions(MONTHS),
          placeholder: "月",
          allowClear: true,
          "onUpdate:value": (v) =>
            onChange("endDate", { ...entry.endDate, month: v ?? null }),
        }),
        h("label", { class: "current-checkbox" }, [
          h("input", {
            type: "checkbox",
            "data-testid": `checkbox-${testId}-current`,
            checked: entry.isCurrent,
            onChange: (e) => onChange("isCurrent", e.target.checked),
          }),
          "至今",
        ]),
      ]),
    ])
  );
}

function entryToolbar(testIdPrefix, index, total, onMoveUp, onMoveDown, onRemove) {
  return h("div", { class: "entry-toolbar" }, [
    h(
      Button,
      {
        size: "small",
        disabled: index === 0,
        "data-testid": `${testIdPrefix}-move-up-${index}`,
        onClick: () => onMoveUp(index),
      },
      { default: () => "上移" }
    ),
    h(
      Button,
      {
        size: "small",
        disabled: index === total - 1,
        "data-testid": `${testIdPrefix}-move-down-${index}`,
        onClick: () => onMoveDown(index),
      },
      { default: () => "下移" }
    ),
    h(
      Button,
      {
        size: "small",
        danger: true,
        "data-testid": `${testIdPrefix}-remove-${index}`,
        onClick: () => onRemove(index),
      },
      { default: () => "删除" }
    ),
  ]);
}

function repeatableTextList(label, testId, list, onChange) {
  return h(Col, { span: 24 }, () =>
    h("div", { class: "field", "data-testid": `field-${testId}` }, [
      h("label", { class: "field-label" }, label),
      h("div", { class: "tag-list" }, [
        ...list.map((item, i) =>
          h("div", { class: "tag-item", key: i }, [
            h(Input, {
              value: item,
              size: "small",
              "data-testid": `input-${testId}-${i}`,
              "onUpdate:value": (v) => {
                const next = [...list];
                next[i] = v;
                onChange(next);
              },
            }),
            h(
              Button,
              {
                size: "small",
                danger: true,
                "data-testid": `remove-${testId}-${i}`,
                onClick: () => onChange(list.filter((_, idx) => idx !== i)),
              },
              { default: () => "×" }
            ),
          ])
        ),
        h(
          Button,
          {
            size: "small",
            "data-testid": `add-${testId}`,
            onClick: () => onChange([...list, ""]),
          },
          { default: () => `+ 添加` }
        ),
      ]),
    ])
  );
}

export default defineComponent({
  name: "OptionsApp",
  setup() {
    const state = reactive({
      loading: true,
      profiles: [],
      activeId: null,
      saveStatus: "",
      importError: "",
    });

    let saveTimer = null;

    const activeProfile = computed(
      () => state.profiles.find((p) => p.id === state.activeId) ?? null
    );

    async function load() {
      // 本机存的可能是旧版本结构，读出来先升级到当前版本再编辑。
      const profiles = (await getResumeProfiles()).map(migrateResumeProfile);
      const activeId = await getActiveProfileId();
      state.profiles =
        profiles.length > 0 ? profiles : [createEmptyResumeProfile(createLocalId())];
      state.activeId = activeId && state.profiles.some((p) => p.id === activeId)
        ? activeId
        : state.profiles[0].id;
      state.loading = false;
    }

    function scheduleSave() {
      state.saveStatus = "保存中…";
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const plainProfiles = JSON.parse(JSON.stringify(state.profiles));
        await saveResumeProfiles(plainProfiles);
        await setActiveProfileId(state.activeId);
        state.saveStatus = "已保存";
      }, 400);
    }

    watch(
      () => [state.profiles, state.activeId],
      () => {
        if (!state.loading) scheduleSave();
      },
      { deep: true }
    );

    function addProfile() {
      const profile = createEmptyResumeProfile(createLocalId());
      state.profiles.push(profile);
      state.activeId = profile.id;
    }

    function removeProfile(id) {
      if (state.profiles.length <= 1) {
        message.warning("至少保留一份简历");
        return;
      }
      state.profiles = state.profiles.filter((p) => p.id !== id);
      if (state.activeId === id) {
        state.activeId = state.profiles[0].id;
      }
    }

    function exportProfiles() {
      const payload = buildExportPayload(state.profiles);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-speedrun-导出-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function handleImportFile(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = parseImportedProfiles(String(reader.result));
          state.profiles = imported;
          state.activeId = imported[0].id;
          state.importError = "";
          message.success("导入成功");
        } catch (error) {
          state.importError = `导入失败：${error.message}`;
        }
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    }

    function renderTopBar() {
      return h(Card, { class: "top-bar-card" }, {
        default: () => [
          h(
            "p",
            { class: "privacy-note" },
            "隐私说明：以上数据只保存在本机浏览器（chrome.storage.local），不会上传到任何服务器。"
          ),
          h("div", { class: "top-bar-row" }, [
            h(Select, {
              style: { width: "200px" },
              "data-testid": "profile-select",
              value: state.activeId ?? undefined,
              options: state.profiles.map((p) => ({
                label: p.name || "未命名简历",
                value: p.id,
              })),
              "onUpdate:value": (v) => (state.activeId = v),
            }),
            h(Input, {
              class: "profile-name-input",
              value: activeProfile.value?.name ?? "",
              "data-testid": "profile-name-input",
              "onUpdate:value": (v) => {
                if (activeProfile.value) activeProfile.value.name = v;
              },
            }),
            h(
              Button,
              { "data-testid": "add-profile-btn", onClick: addProfile },
              { default: () => "+ 新建简历" }
            ),
            h(
              Button,
              {
                danger: true,
                "data-testid": "remove-profile-btn",
                onClick: () => removeProfile(state.activeId),
              },
              { default: () => "删除当前简历" }
            ),
            h(
              Button,
              { "data-testid": "export-btn", onClick: exportProfiles },
              { default: () => "导出 JSON" }
            ),
            h("label", { class: "import-label" }, [
              "导入 JSON",
              h("input", {
                type: "file",
                accept: "application/json",
                class: "import-input",
                "data-testid": "import-input",
                onChange: handleImportFile,
              }),
            ]),
            h("span", { class: "save-status", "data-testid": "save-status" }, state.saveStatus),
          ]),
          state.importError
            ? h("p", { class: "import-error", "data-testid": "import-error" }, state.importError)
            : null,
        ],
      });
    }

    function renderBasicPanel(profile) {
      const b = profile.basic;
      return h(CollapsePanel, { key: "basic", header: "基本信息" }, {
        default: () =>
          h(Row, { gutter: [20, 12] }, () => [
            textField("姓名", "fullName", b.fullName, (v) => (b.fullName = v)),
            selectField("性别", "gender", b.gender, (v) => (b.gender = v), GENDER),
            fullDateField("出生年月日", "birthDate", b.birthDate, (v) =>
              Object.assign(b.birthDate, v)
            ),
            textField("手机", "phone", b.phone, (v) => (b.phone = v)),
            textField("邮箱", "email", b.email, (v) => (b.email = v)),
            selectField("证件类型", "idType", b.idType, (v) => (b.idType = v), ID_TYPE),
            textField("证件号", "idNumber", b.idNumber, (v) => (b.idNumber = v)),
            selectField("民族", "nation", b.nation, (v) => (b.nation = v), NATION, "请选择", 12),
            selectField("政治面貌", "politicalStatus", b.politicalStatus, (v) => (b.politicalStatus = v), POLITICAL_STATUS),
            textField("籍贯", "nativePlace", b.nativePlace, (v) => (b.nativePlace = v)),
            textField("现居城市", "currentCity", b.currentCity, (v) => (b.currentCity = v)),
            textField("国家/地区", "country", b.country, (v) => (b.country = v)),
            selectField("工作经验", "workYears", b.workYears, (v) => (b.workYears = v), WORK_YEARS),
          ]),
      });
    }

    function renderExpectationPanel(profile) {
      const ex = profile.expectation;
      return h(CollapsePanel, { key: "expectation", header: "求职意向" }, {
        default: () =>
          h(Row, { gutter: [20, 12] }, () => [
            textField("期望岗位", "position", ex.position, (v) => (ex.position = v)),
            selectField("所在行业", "currentIndustry", ex.currentIndustry, (v) => (ex.currentIndustry = v), INDUSTRY),
            selectField("期望行业", "expectedIndustry", ex.expectedIndustry, (v) => (ex.expectedIndustry = v), INDUSTRY),
            yearMonthField("到岗时间", "availableDate", ex.availableDate, (v) =>
              Object.assign(ex.availableDate, v)
            ),
            textField("当前薪资", "currentSalary", ex.currentSalary, (v) => (ex.currentSalary = v)),
            textField("期望薪资", "expectedSalary", ex.expectedSalary, (v) => (ex.expectedSalary = v)),
            repeatableTextList("期望城市", "cities", ex.cities, (v) => (ex.cities = v)),
          ]),
      });
    }

    function renderRepeatableSection(label, testIdPrefix, list, createEmpty, key, renderEntry) {
      function add() {
        list.push(createEmpty());
      }
      function remove(index) {
        list.splice(index, 1);
      }
      function moveUp(index) {
        if (index === 0) return;
        [list[index - 1], list[index]] = [list[index], list[index - 1]];
      }
      function moveDown(index) {
        if (index === list.length - 1) return;
        [list[index + 1], list[index]] = [list[index], list[index + 1]];
      }

      return h(CollapsePanel, { key, header: label }, {
        default: () => [
          ...list.map((entry, index) =>
            h(
              Card,
              {
                class: "repeatable-entry-card",
                key: index,
                size: "small",
                "data-testid": `${testIdPrefix}-entry-${index}`,
              },
              {
                default: () => [
                  renderEntry(entry, index),
                  entryToolbar(testIdPrefix, index, list.length, moveUp, moveDown, remove),
                ],
              }
            )
          ),
          h(
            Button,
            { "data-testid": `add-${testIdPrefix}-btn`, onClick: add, style: { marginTop: "8px" } },
            { default: () => `+ 添加${label}` }
          ),
        ],
      });
    }

    function renderEducationPanel(profile) {
      return renderRepeatableSection(
        "教育经历",
        "education",
        profile.education,
        createEmptyEducationEntry,
        "education",
        (entry, index) =>
          h(Row, { gutter: [20, 12] }, () => [
            textField("学校", `edu-school-${index}`, entry.school, (v) => (entry.school = v)),
            selectField("院校类型", `edu-tier-${index}`, entry.schoolTier, (v) => (entry.schoolTier = v), SCHOOL_TIER),
            selectField("学历", `edu-degree-${index}`, entry.degree, (v) => (entry.degree = v), DEGREE),
            selectField("学历类型", `edu-mode-${index}`, entry.degreeMode, (v) => (entry.degreeMode = v), DEGREE_MODE),
            textField("专业", `edu-major-${index}`, entry.major, (v) => (entry.major = v)),
            dateRangeField("起止时间", `edu-${index}`, entry, (field, v) => (entry[field] = v)),
            textField("GPA", `edu-gpa-${index}`, entry.gpa, (v) => (entry.gpa = v)),
            textField("排名", `edu-ranking-${index}`, entry.ranking, (v) => (entry.ranking = v)),
            textField("实验室", `edu-lab-${index}`, entry.lab, (v) => (entry.lab = v)),
            textField("导师", `edu-advisor-${index}`, entry.advisor, (v) => (entry.advisor = v)),
          ])
      );
    }

    function jobEntryFields(prefix) {
      return (entry, index) =>
        h(Row, { gutter: [20, 12] }, () => [
          textField("公司", `${prefix}-company-${index}`, entry.company, (v) => (entry.company = v)),
          textField("职位", `${prefix}-title-${index}`, entry.title, (v) => (entry.title = v)),
          textField("部门", `${prefix}-department-${index}`, entry.department, (v) => (entry.department = v)),
          dateRangeField("起止时间", `${prefix}-${index}`, entry, (field, v) => (entry[field] = v)),
          textAreaField("工作内容", `${prefix}-desc-${index}`, entry.description, (v) => (entry.description = v)),
        ]);
    }

    function renderInternshipPanel(profile) {
      return renderRepeatableSection(
        "实习经历",
        "internship",
        profile.internships,
        createEmptyInternshipEntry,
        "internship",
        jobEntryFields("intern")
      );
    }

    function renderWorkPanel(profile) {
      return renderRepeatableSection(
        "工作经历",
        "work",
        profile.workExperiences,
        createEmptyWorkEntry,
        "work",
        jobEntryFields("work")
      );
    }

    function renderProjectPanel(profile) {
      return renderRepeatableSection(
        "项目经历",
        "project",
        profile.projects,
        createEmptyProjectEntry,
        "project",
        (entry, index) =>
          h(Row, { gutter: [20, 12] }, () => [
            textField("名称", `project-name-${index}`, entry.name, (v) => (entry.name = v)),
            textField("角色", `project-role-${index}`, entry.role, (v) => (entry.role = v)),
            dateRangeField("起止时间", `project-${index}`, entry, (field, v) => (entry[field] = v)),
            textAreaField("描述", `project-desc-${index}`, entry.description, (v) => (entry.description = v)),
          ])
      );
    }

    function renderSkillsPanel(profile) {
      const s = profile.skills;
      return h(CollapsePanel, { key: "skills", header: "技能与其他" }, {
        default: () =>
          h(Row, { gutter: [20, 12] }, () => [
            selectField("英语等级", "englishLevel", s.englishLevel, (v) => (s.englishLevel = v), ENGLISH_LEVEL),
            textAreaField("专业技能", "skills", s.skills, (v) => (s.skills = v)),
            repeatableTextList("证书", "certificates", s.certificates, (v) => (s.certificates = v)),
            repeatableTextList("获奖", "awards", s.awards, (v) => (s.awards = v)),
            textAreaField("语言能力", "languageSkills", s.languageSkills, (v) => (s.languageSkills = v)),
            textField("兴趣爱好", "hobbies", s.hobbies, (v) => (s.hobbies = v), 24),
            textAreaField("自我评价", "selfEvaluation", s.selfEvaluation, (v) => (s.selfEvaluation = v)),
          ]),
      });
    }

    load();

    return () => {
      if (state.loading) {
        return h("div", { class: "loading" }, "加载中…");
      }
      const profile = activeProfile.value;
      return h("div", { class: "options-app" }, [
        h("h1", "简历速通 - 信息库"),
        renderTopBar(),
        profile
          ? h(Card, { class: "profile-card" }, {
              default: () => [
                h(
                  Collapse,
                  {
                    defaultActiveKey: [
                      "basic",
                      "expectation",
                      "education",
                      "internship",
                      "work",
                      "project",
                      "skills",
                    ],
                  },
                  {
                    default: () => [
                      renderBasicPanel(profile),
                      renderExpectationPanel(profile),
                      renderEducationPanel(profile),
                      renderInternshipPanel(profile),
                      renderWorkPanel(profile),
                      renderProjectPanel(profile),
                      renderSkillsPanel(profile),
                    ],
                  }
                ),
              ],
            })
          : null,
      ]);
    };
  },
});
