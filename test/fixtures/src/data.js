// 测试页用的静态选项数据。故意模仿真实网站的写法（比如政治面貌写“团员”
// 而不是标准值“共青团员”、学历写“硕士研究生”），用来验证填写引擎
// 通过 src/shared/options-data/synonyms.js 把标准值对应到网站文案。
export const POLITICAL_STATUS_OPTIONS = ["党员", "预备党员", "团员", "民主党派", "群众"].map(
  (label) => ({ label, value: label })
);

export const NATION_OPTIONS = ["汉族", "壮族", "满族", "回族", "维吾尔族", "苗族", "其他"].map(
  (label) => ({ label, value: label })
);

export const COUNTRY_OPTIONS = ["中国", "美国", "英国", "日本", "新加坡", "澳大利亚"].map(
  (label) => ({ label, value: label })
);

export const SCHOOL_OPTIONS = [
  "清华大学",
  "北京大学",
  "北京大学医学部",
  "复旦大学",
  "上海交通大学",
  "浙江大学",
  "南京大学",
].map((label) => ({ label, value: label }));

export const MAJOR_OPTIONS = [
  "计算机科学与技术",
  "软件工程",
  "电子信息工程",
  "金融学",
  "市场营销",
].map((label) => ({ label, value: label }));

export const DEGREE_OPTIONS = ["大专", "本科", "硕士研究生", "博士研究生"];

export const EXPECTED_CITY_OPTIONS = [
  { label: "北京", value: "bj" },
  { label: "上海", value: "sh" },
  { label: "深圳", value: "sz" },
  { label: "杭州", value: "hz" },
];

export const HOBBY_OPTIONS = [
  { label: "阅读", value: "reading" },
  { label: "运动", value: "sports" },
  { label: "音乐", value: "music" },
];

export const CITY_CASCADER_OPTIONS = [
  {
    label: "北京市",
    value: "beijing",
    children: [{ label: "北京市", value: "beijing-city" }],
  },
  {
    label: "广东省",
    value: "guangdong",
    children: [
      { label: "广州市", value: "guangzhou" },
      { label: "深圳市", value: "shenzhen" },
    ],
  },
  {
    label: "浙江省",
    value: "zhejiang",
    children: [
      { label: "杭州市", value: "hangzhou" },
      { label: "宁波市", value: "ningbo" },
    ],
  },
];

export const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const year = 2026 - i;
  return { label: `${year}年`, value: year };
});

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: i + 1,
}));

export function createEmptyEducationEntry() {
  return {
    school: undefined,
    degree: undefined,
    major: undefined,
    startYear: undefined,
    startMonth: undefined,
    endYear: undefined,
    endMonth: undefined,
    isCurrent: false,
  };
}

export function createEmptyInternshipEntry() {
  return {
    company: "",
    title: "",
    startYear: undefined,
    startMonth: undefined,
    endYear: undefined,
    endMonth: undefined,
    isCurrent: false,
    description: "",
  };
}
