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
 * @property {() => Record<string, string>} getFieldSelectors 返回
 *   "简历标准字段路径 -> CSS 选择器/文案关键词" 的平台专属规则，
 *   matcher 优先用这份规则，找不到再退回通用关键词规则
 */

export {};
