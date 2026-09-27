/**
 * 扫描器：遍历页面 DOM，找出所有"看起来像表单控件"的元素，
 * 输出成统一的 FormField 描述，交给 matcher 去识别每个字段对应简历哪一项。
 *
 * 第 0 阶段只搭接口，不实现具体的组件库探测（Element Plus / Ant Design 的
 * 下拉、日期选择器、级联选择器各自的 DOM 结构留到后续阶段处理）。
 */

/**
 * @typedef {Object} FormField
 * @property {string} id 扫描器生成的临时 id，用于本轮扫描内引用该控件
 * @property {'text'|'select'|'searchable-select'|'date'|'date-range'|'cascader'|'radio'|'checkbox'} controlType
 * @property {string} label 控件关联的文案标签（表单项名称，如"政治面貌"）
 * @property {HTMLElement} element 控件根节点
 * @property {HTMLElement} [container] 控件所在的重复区块容器（用于多段经历定位"添加"按钮）
 */

/**
 * 扫描传入的根节点（默认整个 document），返回本次识别到的所有表单控件。
 * @param {ParentNode} [root]
 * @returns {FormField[]}
 */
export function scanFormFields(root = document) {
  // TODO(第 1 阶段): 遍历 root，按平台适配器提供的选择器 + 通用启发式
  // （label[for]、aria-label、相邻文本节点等）识别控件类型和标签文本。
  void root;
  return [];
}

/**
 * 在页面中定位某个重复区块（如"教育经历"）的"添加/新增"按钮。
 * @param {HTMLElement} sectionContainer
 * @returns {HTMLElement|null}
 */
export function findAddEntryButton(sectionContainer) {
  // TODO(第 1 阶段): 在容器内查找符合"添加/新增"文案且不在黑名单内的按钮。
  void sectionContainer;
  return null;
}
