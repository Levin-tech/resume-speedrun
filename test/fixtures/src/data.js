// 测试页用的静态选项数据，来自 src/shared/options-data，
// 保证以后适配填写引擎时用的字段名称和这里一致。
export const POLITICAL_STATUS_OPTIONS = [
  "中共党员",
  "中共预备党员",
  "共青团员",
  "民主党派",
  "群众",
].map((label) => ({ label, value: label }));

export const NATION_OPTIONS = ["汉族", "壮族", "满族", "回族", "维吾尔族", "苗族", "其他"].map(
  (label) => ({ label, value: label })
);

export const COUNTRY_OPTIONS = ["中国", "美国", "英国", "日本", "新加坡", "澳大利亚"].map(
  (label) => ({ label, value: label })
);

export const SCHOOL_OPTIONS = [
  "清华大学",
  "北京大学",
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
