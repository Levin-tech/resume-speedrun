# 简历速通（resume-speedrun）

给 Claude（以及任何接手这个仓库的人）看的项目说明。详细需求见
`docs/requirements.md`，这里只记录"做这个项目要知道的规矩"。

## 项目是什么

一个免费开源（GPL-3.0）的 Chrome/Edge 浏览器插件，Manifest V3，一套代码
两边通用。目标：在国内网申页面（Moka、北森、飞书招聘优先，之后是牛客、
智联、51job）一键读取本地简历库并填好表单。

**红线：插件绝不自动提交。** 填写完成后必须由用户自己检查、自己点提交。
用户点提交时插件才自动记录这次投递（公司、岗位、网址、日期），可导出
Excel。所有数据只存在浏览器本地（`chrome.storage.local`），不依赖任何
后端服务器，也不应该引入需要网络请求简历数据的功能。

## 整体流程

```
扫描页面控件 (scanner)
  -> 规则识别 (matcher: 平台适配器优先，其次通用关键词规则)
  -> 有把握就填；没把握且用户配置了 AI Key 时，把"这个框对应简历哪一项"
     交给 AI 判断（只发字段标签文本，绝不发送简历内容）
  -> 本地填写 (filler，模拟真实人工操作)
  -> 填后检查清单 (review：已填 / 需确认 / 未填，标出必填项)
  -> 用户自己检查并点击提交
  -> 自动记录投递 (background + storage)
```

## 编码约定

- **模块划分**：见下面的目录结构，新功能优先放进已有模块，不要新建
  平行的目录结构。
- **平台适配器**：每个网站一个文件放在 `src/content/adapters/`，必须
  实现 `adapter-interface.js` 里定义的 `detect()` / `getFieldSelectors()`
  形状；找不到平台专属规则时统一 fallback 到 `generic.js`。网站结构固定
  的（如 Moka）可以再实现可选的 `scanFields()` / `getRepeatableSections()`，
  scanner 优先用适配器的扫描结果；平台自研组件库的操作方式放在
  `filler/controls/<平台>-*.js`，扫描结果用 `kit` 标明。每个平台的页面结构
  写进 `docs/platforms/<平台>.md`。
- **类名带哈希的网站**（如 Moka 的 `sd-Input-input-10L0t`）：选择器一律用
  `[class*="前缀"]` 前缀匹配，绝不写死哈希。
- **绝不点击的按钮**：`SUBMIT_LIKE_BLACKLIST`（定义在
  `src/content/filler/dom-actions.js`，`filler.js` 里重新导出）是硬性
  黑线——任何"提交/保存/下一步/确认/投递/删除"类文案的按钮，filler 都
  不允许点击，表单里会触发提交的按钮也不点（不是 `<button>` 的元素文字里
  带"提交/删除/移除/投递"也不点）。filler 里所有点击都必须走
  `safeClick()`，它在点击前统一做这个检查；唯一允许点击的"新增"类按钮
  也一样。**唯一的例外**：撤销时删掉插件本次自己点"添加"加出来、且内容为空
  （或只有插件填的值）的那一段，走 `dom-actions.js` 的
  `clickDeleteOfAddedEntry()`，它有单独的一套检查（见
  `test/unit/delete-added-entry.test.js`），用户原有的段、用户改过的段绝不删。
- **回读看显示值**：有的组件库（如 Moka）选中后 input.value 一直是空的，选中
  文字在旁边的 display-value 元素里。回读、撤销前记录旧值统一用
  `readShownText()`。
- **填写要像人在操作**：不要直接改 DOM `value` 走捷径，要走真实的鼠标
  /键盘事件序列（点开下拉 -> 等浮层出现 -> 点选项 -> 校验 -> 关闭浮层），
  并且同一时间只处理一个控件，等上一个浮层关闭再处理下一个，避免浮层
  互相遮挡。
- **简历数据结构**：定义在 `src/shared/schema/resume.js`，日期一律存
  `{ year, month }`，可枚举字段（学历、政治面貌、院校类型……）存"标准值"
  （`src/shared/options-data/standard-values.js`），网站实际文案与标准值
  的对应关系放 `synonyms.js`，不要把网站原始文案直接存进简历数据里。
- **测试**：新功能尽量先在 `test/fixtures/` 这个本地测试页里跑通，
  这个测试页用真实的 Ant Design Vue 组件搭建（不是手写的假 DOM），
  更接近真实网申页面的组件行为。适配具体平台时，按实测的页面结构在
  `test/fixtures/<平台>/` 做一个仿真页（如 `test/fixtures/moka/`：类名带
  随机哈希、下拉只响应 mousedown），真实页面由维护者另外验证。单元测试用 vitest，跑
  `npm run test:unit`；端到端/冒烟测试用 Playwright，跑
  `npm run test:e2e`；`npm test` 会按顺序把构建 + 两类测试都跑一遍。
- **注释与文档**：默认不写注释；只在"为什么这么做"不直观时才写一行
  注释（比如这次踩的坑：content script 运行在独立 JS 世界，往
  `window` 上挂标记在页面自己的脚本里是看不到的，要用 DOM 属性）。
- **不要引入后端**：任何"把简历数据发到服务器"的实现都不符合本项目
  的隐私承诺，AI 判断功能也只能发送字段标签文本，不能发送简历内容。

## 目录结构

```
src/
  background/       后台 service worker：消息路由、记录投递、代理 AI 请求
  content/
    scanner/        扫描页面控件
    matcher/        识别控件对应简历哪个字段
    filler/         实际填写（模拟人工操作）：filler.js 串行调度 + 撤销，
                    dom-actions.js 事件/等待/点击检查，controls/ 各类控件
    adapters/       平台适配器（moka.js、generic.js……）
    review/         填后检查清单 UI
    content.js      内容脚本入口，串起上面几个模块
  popup/            工具栏弹窗
  options/          简历库编辑页
  shared/
    schema/         简历数据结构定义
    storage/        chrome.storage.local 封装
    options-data/   标准值枚举 + 同义词表
docs/
  requirements.md   完整需求文档
  platforms/        各平台页面结构与适配说明（moka.md……）
test/
  fixtures/         本地测试页（Ant Design Vue 搭的模拟网申表单）
    moka/           Moka 网申页仿真（照实测结构复刻的 sd- 组件）
  unit/             vitest 单元测试
  e2e/              Playwright 端到端测试（helpers.js 是公共工具）
scripts/            esbuild 构建脚本
```

## 当前阶段

第 3 阶段（填写引擎）已完成：在 `test/fixtures` 测试页上能按识别结果
逐项填写文本框、下拉、可搜索下拉、日期、拆分年月下拉 +"至今"、城市
级联、单选多选，自动补齐多段经历，给出检查清单并支持撤销。

第 4 阶段（Moka 适配）已在仿真页 `test/fixtures/moka/` 上跑通：扫描、
识别、填写（sd- 下拉、年/月、起止时间 +"至今"、出生日期面板、地区三级、
学校/专业联想输入）、补齐多段经历（包括一段都没有的区块）、撤销。结构
与待真实页面确认的细节见 `docs/platforms/moka.md`。简历数据升级到版本 2：
工作经历和实习经历分开存，新增工作经验年限、当前/期望薪资、兴趣爱好、
语言能力；"最高学历""最近毕业专业"这类汇总项从经历里现算（`derived.*`）。

第 4.1 阶段（修复真实 Moka 页面上发现的问题）：仿真页按真实页面改为
"下拉/地区选中后 input.value 为空、文字在 sd-Input-display-value 里"、
出生日期年份要翻页、意向工作城市要输入后等联想、每段有"删除本条"、
Moka 自动存草稿；代码相应修正回读、撤销清空下拉（清不掉时清单提示
"该项需手动清空"）、撤销时删掉插件自己加的空白段、字段映射（公司规模/
公司性质/经历里的所在行业不乱填，工作职责、项目职责、获奖列表按段、
语言能力按英语等级推断并标"需确认"），清单底部提示 Moka 草稿。

已知限制：单选框一旦选中，页面本身就没有"取消选择"的操作，撤销时
没法还原成"未选"，会在清单里标出来请用户手动检查；没有清空按钮的
下拉同理（"该项需手动清空"）。通用页面（非 Moka）上自动点"添加"加出
来的经历区块撤销后保留为空白。上传附件、声明勾选框插件不碰，清单里
提示用户自己处理。

后续：继续在真实 Moka 页面上验证（`docs/platforms/moka.md` 第 8 节的
待确认项）；北森、飞书适配器；AI 兜底；投递记录。
