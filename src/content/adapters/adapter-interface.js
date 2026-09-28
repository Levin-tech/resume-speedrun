/**
 * 平台适配器的统一接口定义（仅类型/文档，无运行时逻辑）。
 *
 * 每新增一个平台（Moka、北森、飞书招聘……），在 adapters/ 下新增一个文件，
 * 导出符合这个形状的对象，并在 adapters/index.js 里注册。
 *
 * @typedef {Object} PlatformAdapter
 * @property {string} id 平台标识，如 "moka"
 * @property {() => boolean} detect 判断当前页面是否属于本平台（如检查
 *   location.hostname 或页面里平台特有的 DOM 标记）
 * @property {() => Record<string, string[]>} getFieldSelectors 返回
 *   "简历标准字段路径 -> 该平台上的标签文案" 的平台专属规则，
 *   matcher 优先用这份规则（标签完全一致才算），找不到再退回通用关键词规则
 * @property {(root: ParentNode) => import('../scanner/scanner.js').FormField[]} [scanFields]
 *   可选：按平台自己的页面结构直接扫描出字段（控件类型、区块、第几段都定好），
 *   scanner 优先用它；返回空数组时退回通用扫描。字段可带 kit（组件库标识，
 *   filler 据此选控件处理器）和 skipReason（不该由插件填的项，如上传附件）
 * @property {(root: ParentNode) => Array<{ title: string, container: Element,
 *   countEntries: () => number, findAddButton: () => HTMLElement|null }>} [getRepeatableSections]
 *   可选：页面上带"添加"按钮的经历区块（包括一段都还没有的），给 filler 补齐段数用
 */

export {};
