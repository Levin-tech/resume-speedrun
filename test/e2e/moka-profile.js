// Moka 仿真页测试用的示例简历（全是虚构数据）。
export const MOKA_PROFILE = {
  id: "e2e-moka",
  schemaVersion: 2,
  name: "Moka 测试简历",
  basic: {
    fullName: "李雷",
    gender: "男",
    birthDate: { year: 2001, month: 5, day: 20 },
    phone: "13900139000",
    email: "lilei@example.com",
    idType: "居民身份证",
    idNumber: "420102200105201234",
    nation: "汉族",
    politicalStatus: "中共预备党员",
    nativePlace: "湖北省武汉市洪山区", // 连着写，要按省/市/区拆开逐级点
    currentCity: "深圳", // 只写了城市名：从"热门地区"里点
    country: "中国",
    workYears: "应届生", // 页面选项写的是"应届毕业生"
  },
  expectation: {
    position: "后端开发工程师",
    cities: ["深圳", "北京"], // 页面是单选：选第一个并标"需确认"
    currentIndustry: "互联网/IT", // 页面选项写的是"互联网"
    expectedIndustry: "互联网/IT",
    availableDate: { year: 2026, month: 7 },
    currentSalary: "", // 故意留空
    expectedSalary: "20-25K",
  },
  education: [
    {
      school: "北京邮电大学（宏福校区）", // 联想里没有这个写法：保留输入文字，标"需确认"
      schoolTier: "211",
      degree: "本科",
      degreeMode: "全日制",
      major: "计算机科学", // 联想里只有"计算机科学与技术"：选最接近的，标"需确认"
      startDate: { year: 2019, month: 9 },
      endDate: { year: 2023, month: 6 },
      isCurrent: false,
    },
    {
      school: "华中科技大学",
      schoolTier: "985",
      degree: "硕士",
      degreeMode: "全日制",
      major: "软件工程",
      startDate: { year: 2023, month: 9 },
      endDate: { year: 2026, month: 6 },
      isCurrent: false,
    },
  ],
  workExperiences: [
    {
      company: "速通科技",
      title: "后端工程师",
      department: "",
      startDate: { year: 2026, month: 7 },
      endDate: { year: null, month: null },
      isCurrent: true,
      description: "负责网申系统后端",
    },
  ],
  internships: [
    {
      company: "字节跳动",
      title: "后端开发实习生",
      department: "",
      startDate: { year: 2022, month: 12 },
      endDate: { year: 2023, month: 3 },
      isCurrent: false,
      description: "负责推荐系统接口开发",
    },
    {
      company: "腾讯",
      title: "算法实习生",
      department: "",
      startDate: { year: 2024, month: 7 },
      endDate: { year: 2024, month: 10 },
      isCurrent: false,
      description: "参与广告召回模型优化",
    },
  ],
  projects: [
    {
      name: "简历速通",
      role: "负责人",
      startDate: { year: 2025, month: 1 },
      endDate: { year: null, month: null },
      isCurrent: true,
      description: "浏览器插件，一键填写网申表单",
    },
  ],
  skills: {
    englishLevel: "CET-6",
    skills: "Java、Go、MySQL",
    certificates: [],
    awards: ["国家奖学金（2021）", "ACM 区域赛银牌"],
    selfEvaluation: "踏实肯干，喜欢钻研",
    hobbies: "跑步、摄影",
    languageSkills: "",
  },
};
