// 网申表单模拟页：用真实的 Ant Design Vue 组件搭建，
// 给填写引擎在真实组件库 DOM 结构上做冒烟测试用。
// 不用 .vue 单文件组件（避免引入编译工具链），直接用 h() 渲染函数。
import { defineComponent, h, reactive } from "vue";
import {
  Input,
  Select,
  DatePicker,
  Cascader,
  Radio,
  Checkbox,
  Button,
  Card,
  Divider,
} from "ant-design-vue";
import {
  POLITICAL_STATUS_OPTIONS,
  NATION_OPTIONS,
  COUNTRY_OPTIONS,
  SCHOOL_OPTIONS,
  MAJOR_OPTIONS,
  DEGREE_OPTIONS,
  EXPECTED_CITY_OPTIONS,
  HOBBY_OPTIONS,
  CITY_CASCADER_OPTIONS,
  YEAR_OPTIONS,
  MONTH_OPTIONS,
  createEmptyEducationEntry,
  createEmptyInternshipEntry,
} from "./data.js";

const RadioGroup = Radio.Group;
const CheckboxGroup = Checkbox.Group;

function field(label, testId, control, { required = false } = {}) {
  return h("div", { class: "field", "data-testid": `field-${testId}` }, [
    h("label", { class: "field-label" }, [
      label,
      required ? h("span", { class: "required" }, "*") : null,
    ]),
    h("div", { class: "field-control" }, control),
  ]);
}

// 很多网申网站不用组件库的单选框，而是自己画的“标签式”单选，这里模仿一个。
const TagRadioGroup = defineComponent({
  props: { value: String, options: Array },
  emits: ["update:value"],
  setup(props, { emit }) {
    return () =>
      h(
        "div",
        { class: "tag-radio-group", role: "radiogroup" },
        props.options.map((option) =>
          h(
            "span",
            {
              class: ["tag-radio", { "tag-radio-checked": props.value === option }],
              role: "radio",
              "aria-checked": String(props.value === option),
              tabindex: 0,
              onClick: () => emit("update:value", option),
            },
            option
          )
        )
      );
  },
});

function yearMonthSelect(entry, key, options, placeholder, width, disabled = false) {
  return h(Select, {
    value: entry[key],
    "onUpdate:value": (v) => (entry[key] = v),
    options,
    allowClear: true,
    disabled,
    style: { width },
    placeholder,
  });
}

function dateRangeField(entry) {
  return h("div", { class: "field date-range" }, [
    h("label", { class: "field-label" }, "起止时间"),
    h("div", { class: "field-control date-range-control" }, [
      yearMonthSelect(entry, "startYear", YEAR_OPTIONS, "起始年", "100px"),
      yearMonthSelect(entry, "startMonth", MONTH_OPTIONS, "起始月", "90px"),
      h("span", { class: "date-range-sep" }, "—"),
      yearMonthSelect(entry, "endYear", YEAR_OPTIONS, "结束年", "100px", entry.isCurrent),
      yearMonthSelect(entry, "endMonth", MONTH_OPTIONS, "结束月", "90px", entry.isCurrent),
      h(
        Checkbox,
        {
          checked: entry.isCurrent,
          "onUpdate:checked": (v) => (entry.isCurrent = v),
        },
        { default: () => "至今" }
      ),
    ]),
  ]);
}

// dayjs 对象序列化时会转成 UTC 时间字符串，测试里要看“本地日期”，这里手动转。
function toPlain(value) {
  if (value && typeof value === "object" && typeof value.format === "function") {
    return value.format("YYYY-MM-DD");
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value ?? null;
}

export default defineComponent({
  name: "App",
  setup() {
    const state = reactive({
      fullName: "",
      phone: "",
      email: "",
      idNumber: "",
      gender: undefined,
      politicalStatus: undefined,
      nation: undefined,
      country: undefined,
      city: undefined,
      expectedCities: [],
      hobbies: [],
      birthDate: undefined,
      availableDate: undefined,
      education: [createEmptyEducationEntry()],
      internships: [createEmptyInternshipEntry()],
      submitted: false,
    });

    // 给 Playwright 测试读取“组件库内部的表单值”（不是页面显示的文字），
    // 以及统计提交/添加按钮被点击了几次。插件内容脚本运行在独立的 JS 世界，
    // 看不到也碰不到这个对象。
    const counters = { submitClicks: 0, addEducationClicks: 0, addInternshipClicks: 0 };
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest?.('[data-testid="submit-btn"]')) counters.submitClicks += 1;
      },
      true
    );
    window.__fixture = {
      counters,
      snapshot: () => toPlain(state),
    };

    function addEducation() {
      counters.addEducationClicks += 1;
      state.education.push(createEmptyEducationEntry());
    }
    function addInternship() {
      counters.addInternshipClicks += 1;
      state.internships.push(createEmptyInternshipEntry());
    }
    function onSubmit() {
      // 冒烟测试确认：这个按钮只应由“用户”点击，插件代码绝不能调用它。
      state.submitted = true;
    }

    return () =>
      h("div", { class: "fixture-page" }, [
        h("h1", "网申表单模拟页（Ant Design Vue）"),

        h(Card, { title: "基本信息", class: "section" }, {
          default: () => [
            field(
              "姓名",
              "full-name",
              h(Input, {
                value: state.fullName,
                "onUpdate:value": (v) => (state.fullName = v),
                placeholder: "请输入姓名",
              }),
              { required: true }
            ),
            field(
              "手机号",
              "phone",
              h(Input, {
                value: state.phone,
                "onUpdate:value": (v) => (state.phone = v),
                placeholder: "请输入手机号",
              }),
              { required: true }
            ),
            field(
              "邮箱",
              "email",
              h(Input, {
                value: state.email,
                "onUpdate:value": (v) => (state.email = v),
                placeholder: "请输入邮箱",
              })
            ),
            field(
              "身份证号",
              "id-number",
              h(Input, {
                value: state.idNumber,
                "onUpdate:value": (v) => (state.idNumber = v),
                placeholder: "请输入身份证号",
              }),
              { required: true }
            ),
            field(
              "性别",
              "gender",
              h(
                RadioGroup,
                {
                  value: state.gender,
                  "onUpdate:value": (v) => (state.gender = v),
                },
                {
                  default: () => [
                    h(Radio, { value: "男" }, { default: () => "男" }),
                    h(Radio, { value: "女" }, { default: () => "女" }),
                  ],
                }
              )
            ),
            field(
              "出生日期",
              "birth-date",
              h(DatePicker, {
                value: state.birthDate,
                "onUpdate:value": (v) => (state.birthDate = v),
              })
            ),
            field(
              "政治面貌",
              "political-status",
              h(Select, {
                value: state.politicalStatus,
                "onUpdate:value": (v) => (state.politicalStatus = v),
                options: POLITICAL_STATUS_OPTIONS,
                allowClear: true,
                style: { width: "200px" },
                placeholder: "请选择",
              })
            ),
            field(
              "民族",
              "nation",
              h(Select, {
                value: state.nation,
                "onUpdate:value": (v) => (state.nation = v),
                options: NATION_OPTIONS,
                allowClear: true,
                style: { width: "200px" },
                placeholder: "请选择",
              })
            ),
            field(
              "国家/地区（可搜索）",
              "country",
              h(Select, {
                value: state.country,
                "onUpdate:value": (v) => (state.country = v),
                options: COUNTRY_OPTIONS,
                showSearch: true,
                allowClear: true,
                optionFilterProp: "label",
                style: { width: "200px" },
                placeholder: "输入并选择",
              })
            ),
            field(
              "现居城市（级联）",
              "city",
              h(Cascader, {
                value: state.city,
                "onUpdate:value": (v) => (state.city = v),
                options: CITY_CASCADER_OPTIONS,
                fieldNames: { label: "label", value: "value", children: "children" },
                style: { width: "240px" },
                placeholder: "请选择省/市",
              })
            ),
            field(
              "期望城市（多选）",
              "expected-cities",
              h(CheckboxGroup, {
                value: state.expectedCities,
                "onUpdate:value": (v) => (state.expectedCities = v),
                options: EXPECTED_CITY_OPTIONS,
              })
            ),
            field(
              "到岗时间",
              "available-date",
              // inputReadOnly：不能直接打字，只能打开面板点选年、月。
              h(DatePicker, {
                value: state.availableDate,
                "onUpdate:value": (v) => (state.availableDate = v),
                picker: "month",
                inputReadOnly: true,
              })
            ),
            field(
              "兴趣爱好（多选）",
              "hobbies",
              h(CheckboxGroup, {
                value: state.hobbies,
                "onUpdate:value": (v) => (state.hobbies = v),
                options: HOBBY_OPTIONS,
              })
            ),
          ],
        }),

        h(
          Card,
          { title: "教育经历", class: "section", "data-testid": "section-education" },
          {
            default: () => [
              ...state.education.map((entry, index) =>
                h(
                  "div",
                  { class: "repeatable-entry", key: index, "data-testid": `education-entry-${index}` },
                  [
                    field(
                      "学校（可搜索）",
                      `school-${index}`,
                      h(Select, {
                        value: entry.school,
                        "onUpdate:value": (v) => (entry.school = v),
                        options: SCHOOL_OPTIONS,
                        showSearch: true,
                        allowClear: true,
                        optionFilterProp: "label",
                        style: { width: "220px" },
                        placeholder: "输入并选择学校",
                      })
                    ),
                    field(
                      "学历",
                      `degree-${index}`,
                      h(TagRadioGroup, {
                        value: entry.degree,
                        "onUpdate:value": (v) => (entry.degree = v),
                        options: DEGREE_OPTIONS,
                      })
                    ),
                    field(
                      "专业（可搜索）",
                      `major-${index}`,
                      h(Select, {
                        value: entry.major,
                        "onUpdate:value": (v) => (entry.major = v),
                        options: MAJOR_OPTIONS,
                        showSearch: true,
                        allowClear: true,
                        optionFilterProp: "label",
                        style: { width: "220px" },
                        placeholder: "输入并选择专业",
                      })
                    ),
                    dateRangeField(entry),
                  ]
                )
              ),
              h(
                Button,
                { onClick: addEducation, "data-testid": "add-education-btn" },
                { default: () => "+ 添加教育经历" }
              ),
            ],
          }
        ),

        h(
          Card,
          { title: "实习经历", class: "section", "data-testid": "section-internship" },
          {
            default: () => [
              ...state.internships.map((entry, index) =>
                h(
                  "div",
                  { class: "repeatable-entry", key: index, "data-testid": `internship-entry-${index}` },
                  [
                    field(
                      "公司名称",
                      `company-${index}`,
                      h(Input, {
                        value: entry.company,
                        "onUpdate:value": (v) => (entry.company = v),
                        placeholder: "请输入公司名称",
                      })
                    ),
                    field(
                      "职位名称",
                      `title-${index}`,
                      h(Input, {
                        value: entry.title,
                        "onUpdate:value": (v) => (entry.title = v),
                        placeholder: "请输入职位名称",
                      })
                    ),
                    dateRangeField(entry),
                    field(
                      "工作内容",
                      `description-${index}`,
                      h(Input.TextArea, {
                        value: entry.description,
                        "onUpdate:value": (v) => (entry.description = v),
                        rows: 3,
                      })
                    ),
                  ]
                )
              ),
              h(
                Button,
                { onClick: addInternship, "data-testid": "add-internship-btn" },
                { default: () => "+ 添加实习经历" }
              ),
            ],
          }
        ),

        h(Divider),
        h(
          Button,
          {
            type: "primary",
            danger: true,
            onClick: onSubmit,
            "data-testid": "submit-btn",
          },
          { default: () => "提交申请（请勿在自动化测试中点击）" }
        ),
        state.submitted
          ? h("p", { "data-testid": "submitted-marker" }, "已提交（仅测试标记，未发送到任何服务器）")
          : null,
      ]);
  },
});
