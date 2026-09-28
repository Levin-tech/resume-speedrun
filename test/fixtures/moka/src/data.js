// Moka 仿真页的选项数据，文案按 2026-09 实测的 Moka 页面写。
const toOptions = (labels) => labels.map((label) => ({ label, value: label }));

export const GENDER_OPTIONS = toOptions(["男", "女"]);

export const POLITICAL_STATUS_OPTIONS = toOptions([
  "中共党员",
  "中共预备党员",
  "共青团员",
  "民革党员",
  "民盟盟员",
  "民建会员",
  "民进会员",
  "农工党党员",
  "致公党党员",
  "九三学社社员",
  "台盟盟员",
  "无党派人士",
  "群众",
]);

export const NATION_OPTIONS = toOptions(["汉族", "壮族", "回族", "满族", "维吾尔族", "苗族", "土家族", "其他"]);

export const WORK_YEARS_OPTIONS = toOptions(["应届毕业生", "1年以下", "1-3年", "3-5年", "5-10年", "10年以上"]);

export const HIGHEST_DEGREE_OPTIONS = toOptions(["高中", "大专", "本科", "硕士", "博士", "MBA"]);

export const DEGREE_OPTIONS = toOptions(["大专", "本科", "硕士", "博士"]);

export const CITY_OPTIONS = toOptions(["北京", "上海", "广州", "深圳", "杭州", "武汉", "成都"]);

export const INDUSTRY_OPTIONS = toOptions(["互联网", "金融", "教育", "医疗健康", "制造业", "其他"]);

export const PHONE_CODE_OPTIONS = toOptions(["+86", "+852", "+853", "+886", "+1"]);

export const ID_TYPE_OPTIONS = toOptions(["身份证", "护照", "港澳居民来往内地通行证", "台湾居民来往大陆通行证"]);

// "年"：从 2126 往下的长列表；"月"：1~12。
export const YEAR_OPTIONS = Array.from({ length: 200 }, (_, i) => {
  const year = 2126 - i;
  return { label: String(year), value: year };
});

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));

export const SCHOOL_CANDIDATES = [
  "北京大学",
  "北京大学医学部",
  "北京邮电大学",
  "北京理工大学",
  "清华大学",
  "华中科技大学",
  "华中师范大学",
  "武汉大学",
  "复旦大学",
];

export const MAJOR_CANDIDATES = [
  "计算机科学与技术",
  "软件工程",
  "电子信息工程",
  "人工智能",
  "金融学",
  "市场营销",
];

export const REGIONS = [
  {
    name: "北京市",
    children: [{ name: "北京市", children: [{ name: "海淀区" }, { name: "朝阳区" }] }],
  },
  {
    name: "上海市",
    children: [{ name: "上海市", children: [{ name: "浦东新区" }, { name: "徐汇区" }] }],
  },
  {
    name: "广东省",
    children: [
      { name: "广州市", children: [{ name: "天河区" }, { name: "越秀区" }] },
      { name: "深圳市", children: [{ name: "南山区" }, { name: "福田区" }] },
    ],
  },
  {
    name: "湖北省",
    children: [
      { name: "武汉市", children: [{ name: "武昌区" }, { name: "洪山区" }] },
      { name: "宜昌市", children: [{ name: "西陵区" }] },
    ],
  },
  {
    name: "浙江省",
    children: [{ name: "杭州市", children: [{ name: "西湖区" }, { name: "余杭区" }] }],
  },
];

export const HOT_CITIES = ["北京", "上海", "广州", "深圳", "杭州"];

export function createEducationEntry() {
  return { school: "", major: "", degree: null, startYear: null, startMonth: null, endYear: null, endMonth: null };
}

export function createWorkEntry() {
  return {
    company: "",
    title: "",
    startYear: null,
    startMonth: null,
    endYear: null,
    endMonth: null,
    isCurrent: false,
    reportTo: "",
    leaveReason: "",
    description: "",
  };
}

export function createInternshipEntry() {
  return {
    company: "",
    title: "",
    startYear: null,
    startMonth: null,
    endYear: null,
    endMonth: null,
    isCurrent: false,
    description: "",
  };
}

export function createProjectEntry() {
  return {
    name: "",
    role: "",
    startYear: null,
    startMonth: null,
    endYear: null,
    endMonth: null,
    isCurrent: false,
    description: "",
  };
}
