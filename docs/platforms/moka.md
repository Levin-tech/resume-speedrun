# Moka（app.mokahr.com）网申页适配说明

结构来源：2026-09 在 app.mokahr.com 网申页实测。代码在：

- 适配器（扫描、识别规则）：`src/content/adapters/moka.js`
- 控件填写：`src/content/filler/controls/moka-*.js`
- 仿真测试页：`test/fixtures/moka/`（`npm run build:fixtures` 后访问
  `http://127.0.0.1:4173/moka/`，先 `node scripts/static-server.mjs`）
- 端到端测试：`test/e2e/moka.spec.js`，单元测试：`test/unit/moka-adapter.test.js`

## 1. 类名规则

Moka 用自研组件库，类名前缀 `sd-`，并且带 CSS Modules 哈希后缀，例如
`sd-Input-input-10L0t`、`apply-field-Q2iJ7AtQGX`。哈希每次发版都可能变，所以：

- **选择器一律用 `[class*="xxx"]` 前缀匹配，绝不写死哈希。**
- 区分 `apply-field` / `apply-fields` / `apply-block` / `apply-blocks` 这种只差一个
  字母的类名时，用 `hasClassBase()`：类名本身，或者"基础名 + `-` + 一段哈希"。
  哈希要求至少 4 位、不含 `-`、并且混有大写/数字/下划线——这样
  `apply-field-title`（普通子类名）不会被当成字段。

## 2. 页面层级

```
div.apply-blocks
  div.apply-block                       一个区块
    [class*=blockTitle]                 区块标题（"个人信息""教育背景"……）
      …"添加"                           可重复的区块标题里有"添加"按钮
    div.apply-fields                    一段经历一组（第 0 段、第 1 段……）
      div.apply-field <类型类名> [full-width-field]   一个字段
        [class*="title"]                字段标签
          [class*="required-asterisk"]  必填星号
        …控件…
button.sd-Button-primary "预览并提交"   提交按钮（插件绝不点）
```

- **区块标题** = `blockTitle` 的文字去掉"添加"按钮的文字和"+"。
- **第几段** = 字段所在 `apply-fields` 在区块里的顺序。
- **可重复区块** = 标题里有"添加"，或者区块里有不止一段。只有可重复区块里的字段
  会在检查清单里显示成"实习经历 第 2 段 · 公司名称"。
- 区块标题 → 简历里的哪类经历：`matcher.js` 的 `detectSectionFromTitle`
  （教育/学历/学校 → 教育经历；含"实习" → 实习经历；工作/职业/就业 → 工作经历；
  项目 → 项目经历）。实测区块：个人信息、求职意向、工作经历、教育背景、实习经历、
  项目经验、语言能力、自我描述、获奖经历。

## 3. 字段类型（apply-field 的第二个类名）

| 类型类名 | 含义 | 扫描出的控件类型 | 插件怎么填 |
| --- | --- | --- | --- |
| `string_info` | 单行文本 | `text` | 原生赋值 + input/change/blur |
| `string_info` + 内含 `sd-Dropdown` | 输入后出联想候选（学校名称、专业名称、最近毕业专业） | `suggest` | 见 4.4 |
| `text_info` | 多行文本 | `textarea` | 同文本；获奖这类多条的每条一行 |
| `Select` | 下拉 | `select` | 见 4.1 |
| `date_info`（2 个输入框） | 年、月 | `year-month` | 年、月各选一次 |
| `date_info full-width-field`（4 个输入框） | 起止时间：年、月、年、月，工作/实习/项目带"至今" `sd-Checkbox` | `date-range-group` | 见 4.2 |
| `day_info` | 出生日期面板 | `date` | 见 4.3 |
| `location_info` | 省/市/区三级 | `cascader` | 见 4.5 |
| `file_upload` / `attachment_upload` | 上传 | `upload` | **跳过**，清单里提示"请你自己上传" |
| `confirm_info` | 确认勾选框 | `confirm` | **跳过**，清单里提示"请你自己阅读后勾选" |
| 其他没见过的 | — | `unknown` | 跳过，提示"暂不支持" |

字段扫描结果都带 `kit: "moka"`，填写时 `filler.js` 按 `kit` 选 Moka 的控件处理器。

## 4. 控件结构与操作方式

### 4.1 下拉（Select、年、月）

```
label.sd-Input-container.sd-Select-container > input.sd-Input-input
（打开后，浮层渲染在字段内部）
sd-Dropdown-container > sd-Dropdown-dropdown > sd-Select-menu
  > .sd-Menu-content-item（选项文字在 .option-label 里，或直接是文本）
```

- **打开**：必须在 input 上依次派发 pointerdown、mousedown、focus、mouseup、click，
  **只 click 打不开**（`safeClick(input, { focus: true })`）。
- 找浮层：从 input 往外一层层找，到字段边界为止（一个字段里有年、月、年、月四个
  下拉时，离得最近的才是自己的）。
- 点选项后等浮层关闭，**回读 input 的显示值**校验。
- "年"：选项从 2126 往下的长列表，输入框可以打字，插件先输入年份过滤再点；
  "月"：1~12。
- 手机号码、证件号码：前面有区号/证件类型的小下拉（+86、身份证），号码填在后面
  的普通输入框，小下拉保持默认。

### 4.2 起止时间 + 至今

四个下拉按顺序是开始年、开始月、结束年、结束月。"至今"是字段里文字含"至今"的
`sd-Checkbox`：简历里"至今"就勾上、不填结束时间；否则先取消勾选再填结束年月。
勾选状态看里面原生 checkbox 的 `checked`，没有原生 checkbox 时看类名里的 `checked`。

### 4.3 出生日期（day_info）

只读输入框，mousedown 打开 `sd-panal-menu-wrapper` 面板（Moka 自己就拼成 panal）：
顶部年份选择 `sd-basic-selector-year`（如"1990年"），下方月份
`sd-basic-year-item`（一月…十二月），再选日。插件：点年份 → 在面板里找"2001年"
点它 → 点"五月" → 点"20"。简历里没有具体到日时按 1 号填并标"需确认"。

### 4.4 联想输入（学校名称、专业名称、最近毕业专业）

打字 → 等候选（最多 2 秒）→ 点最匹配的候选：完全一样算"已填"，只是最接近的
标"需确认"；**一个候选都没有时保留输入的文字并标"需确认"**。

### 4.5 地区（籍贯、所在地）

只读输入框，mousedown 打开 `menu-wrapper` 面板：有"热门地区"标签（`sd-Tag`）和
"省份/城市/县区"三个页签，逐级点选。插件：

- 简历里写全了（"湖北省武汉市洪山区"会按省/市/区后缀拆开）就逐级点；
- 只写了城市名（"深圳"）先看热门地区，没有再挨个省份展开找，找不到就清回原样。

## 5. 字段对应（识别规则）

通用关键词规则在 `matcher.js`；Moka 上叫法特殊、放在通用规则里容易误伤的，写在
`mokaAdapter.getFieldSelectors()`（标签完全一致才算，只用于经历区块外）：

| Moka 标签 | 简历字段 | 说明 |
| --- | --- | --- |
| 所在地 | `basic.currentCity` | 通用规则不认"所在地"，免得把"户口所在地"认错 |
| 工作经验 | `basic.workYears` | 应届生 / 1年以下 / 1-3年 …（同义词：应届毕业生） |
| 最高学历 | `derived.highestDegree` | 从教育经历里现算 |
| 最近毕业专业 | `derived.latestMajor` | 毕业最晚那段的专业 |
| 毕业时间 | `derived.graduationDate` | 毕业最晚那段的结束年月（教育区块里的"毕业时间"是那一段的结束时间） |
| 目前职位 | `derived.currentTitle` | 在职的工作 > 在职的实习 > 第一段工作 |
| 意向工作城市 | `expectation.cities` | 页面单选、简历有多个时选第一个并标"需确认" |
| 语言能力 | `derived.languageAbility` | 自己写的语言能力，没有就用"英语 + 英语等级" |

其余（所在行业、期望行业、到岗时间、当前薪资、期望薪资、期望职位、技能、获奖经历、
兴趣爱好、自我描述……）走通用关键词规则。

**信息库里故意没有的项**（推荐码、内推码、汇报对象、离职原因、简历更新时间、
下属人数）不去乱猜，检查清单里标"未填 · 信息库无此项"。

## 6. 经历段数补齐

`mokaAdapter.getRepeatableSections()` 列出所有标题里带"添加"的区块（**包括一段都
还没有、只有标题和"添加"的区块**，比如项目经验）。简历段数比页面多时，filler 点
"添加"（点之前照样过黑名单检查），等新的一段 `apply-fields` 出现后重新扫描再填。

## 7. 绝不点击

"预览并提交"含"提交"，被 `SUBMIT_LIKE_BLACKLIST` 拦截（`test/unit/click-guard.test.js`
和 `test/e2e/moka.spec.js` 都断言了点击次数为 0）。上传、确认勾选框插件也不碰。

## 8. 仿真页里是推测、需要在真实页面上确认的细节

实测记录没写到的细节，仿真页按最常见的做法实现，代码里也尽量写得宽松。
**在真实页面上发现不一样时，先改仿真页复现，再改代码**：

1. **"添加"按钮的元素**：插件找区块标题里文字含"添加/新增"的最里层元素点击
   （事件会冒泡）。如果真实页面的"添加"不在 `blockTitle` 里，要改 `findAddButton`。
2. **清空按钮**：撤销时要把下拉/日期/地区清空，插件把鼠标移到输入框上、点类名含
   `clear` 的按钮。真实页面如果没有清空按钮，撤销时这几项会在清单里标"没法自动
   还原"。
3. **出生日期面板选年份的方式**：仿真页是点"1990年"弹出年份列表再点目标年份。
   如果真实页面是左右翻页箭头，要在 `moka-birthday.js` 的 `pickYear` 里加翻页。
   日期格子的类名未知，插件按"面板里文字正好是这个数字的叶子元素"找。
4. **地区面板里地名的元素**：插件找面板里类名含 `item` 的元素或 `li`（排除热门
   标签和页签）。仿真页每选一级就写回输入框；如果真实页面要选到县区才写回，
   简历只写到城市时会在清单里标出来。
5. **联想候选的位置**：仿真页和下拉一样渲染在字段内部。真实页面如果挂在 body 下，
   插件会退一步找页面上不属于任何字段的可见浮层。

排查方法：在真实页面上点插件弹窗里的"扫描诊断"→"导出诊断报告"，报告里有每个
字段的控件类型、区块、第几段、对应的简历字段和精简 DOM 信息（不含任何填写值）。
