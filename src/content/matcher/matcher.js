/**
 * 识别器：把 scanner 输出的 FormField 对应到简历标准字段上。
 *
 * 识别优先级（从高到低）：
 *   1. 平台适配器规则（src/content/adapters/<platform>.js 里的精确选择器/文案）
 *   2. 通用关键词规则（标签文本关键词匹配，如"政治面貌"→ politicalStatus）
 *   3. 都没把握、且用户配置了 AI Key 时，调用 background 里的 AI 判断
 *      （只发送字段标签文本，不发送简历内容）
 *
 * 第 0 阶段只搭接口和分档结构，不实现具体规则表。
 */

/**
 * @typedef {Object} MatchResult
 * @property {string} fieldId 对应 FormField.id
 * @property {string|null} resumeField 简历标准字段路径，如 "basic.politicalStatus"
 * @property {'adapter'|'keyword'|'ai'|'none'} matchedBy 命中方式
 * @property {number} confidence 0~1 置信度，供 review 清单展示"需确认"
 */

/**
 * @param {import('../scanner/scanner.js').FormField[]} fields
 * @param {{ platform: string, useAi: boolean }} context
 * @returns {Promise<MatchResult[]>}
 */
export async function matchFields(fields, context) {
  // TODO(第 1 阶段): 依次尝试 adapter 规则 -> 通用关键词规则 -> AI 兜底。
  void context;
  return fields.map((field) => ({
    fieldId: field.id,
    resumeField: null,
    matchedBy: "none",
    confidence: 0,
  }));
}

/**
 * 通用关键词规则表：标签文本关键词 -> 简历标准字段路径。
 * 供 matchFields 在没有平台适配器覆盖时兜底使用。
 * @type {Record<string, string>}
 */
export const GENERIC_KEYWORD_RULES = {
  姓名: "basic.fullName",
  性别: "basic.gender",
  手机: "basic.phone",
  手机号: "basic.phone",
  邮箱: "basic.email",
  电子邮箱: "basic.email",
  民族: "basic.nation",
  政治面貌: "basic.politicalStatus",
  籍贯: "basic.nativePlace",
  现居地: "basic.currentCity",
};
