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
  形状；找不到平台专属规则时统一 fallback 到 `generic.js`。
- **绝不点击的按钮**：`SUBMIT_LIKE_BLACKLIST`（定义在
  `src/content/filler/dom-actions.js`，`filler.js` 里重新导出）是硬性
  黑线——任何"提交/保存/下一步/确认/投递/删除"类文案的按钮，filler 都
  不允许点击，表单里会触发提交的按钮也不点。filler 里所有点击都必须走
  `safeClick()`，它在点击前统一做这个检查；唯一允许点击的"新增"类按钮
  也一样。
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
  更接近真实网申页面的组件行为。单元测试用 vitest，跑
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
test/
  fixtures/         本地测试页（Ant Design Vue 搭的模拟网申表单）
  unit/             vitest 单元测试
  e2e/              Playwright 冒烟测试
scripts/            esbuild 构建脚本
```

## 当前阶段

第 3 阶段（填写引擎）已完成：在 `test/fixtures` 测试页上能按识别结果
逐项填写文本框、下拉、可搜索下拉、日期、拆分年月下拉 +"至今"、城市
级联、单选多选，自动补齐多段经历，给出检查清单并支持撤销。

已知限制：单选框一旦选中，页面本身就没有"取消选择"的操作，撤销时
没法还原成"未选"，会在清单里标出来请用户手动检查；自动点"添加"加出
来的经历区块撤销后保留为空白（插件不点删除）。

后续：按平台（Moka、北森、飞书……）补适配器、接入 AI 兜底、投递记录。
