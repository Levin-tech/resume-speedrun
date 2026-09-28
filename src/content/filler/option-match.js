/**
 * 选项匹配（纯函数，不碰 DOM）：给定简历里的标准值和页面上的一组选项文案，
 * 挑出最该点的那一个，并区分"完全匹配"和"只是最接近、需要用户确认"。
 */

import { getSynonymMap } from "../../shared/options-data/synonyms.js";

const IGNORED_CHARS = /[\s　·•\-—–_()（）【】[\]、,，.。:：;；/\\'"“”‘’]/g;
const ADMIN_SUFFIX = /(特别行政区|自治区|自治州|地区|省|市|区|县)$/;

export function normalizeText(text) {
  return String(text ?? "")
    .replace(IGNORED_CHARS, "")
    .toLowerCase();
}

/** "广东省" -> "广东"、"深圳市" -> "深圳"，用于地名比较。 */
export function stripAdminSuffix(text) {
  const normalized = normalizeText(text);
  const stripped = normalized.replace(ADMIN_SUFFIX, "");
  return stripped.length >= 2 ? stripped : normalized;
}

/**
 * 标准值 + 同义词表里的各种写法，作为在页面上找选项的候选文案。
 * @param {string} fieldName 简历字段名（路径最后一段），如 "politicalStatus"
 * @param {string} value 标准值
 * @returns {string[]}
 */
export function buildCandidates(fieldName, value) {
  const standard = String(value ?? "").trim();
  if (!standard) return [];
  const synonyms = getSynonymMap(fieldName)?.[standard] ?? [];
  return Array.from(new Set([standard, ...synonyms]));
}

function bigrams(text) {
  const grams = new Set();
  for (let i = 0; i < text.length - 1; i += 1) grams.add(text.slice(i, i + 2));
  return grams;
}

/** 两段文字的相似度（Dice 系数，0~1）。 */
export function similarity(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const gx = bigrams(x);
  const gy = bigrams(y);
  if (gx.size === 0 || gy.size === 0) return 0;
  let overlap = 0;
  for (const g of gx) if (gy.has(g)) overlap += 1;
  return (2 * overlap) / (gx.size + gy.size);
}

/**
 * @typedef {Object} OptionPick
 * @property {number} index 选中的选项下标
 * @property {string} text 选中的选项文案
 * @property {boolean} exact 是否完全匹配（否则需要用户确认）
 */

/**
 * 从选项文案里挑出与候选文案最匹配的一项。
 * 优先级：原文相同 > 去掉空格标点后相同 > 去掉"省/市"后相同（都算完全匹配）
 *        > 互相包含 > 文字相似度 ≥ 0.5（这两种算"最接近"，需要确认）。
 * @param {string[]} optionTexts
 * @param {string[]} candidates
 * @returns {OptionPick|null}
 */
export function pickBestOption(optionTexts, candidates) {
  const options = optionTexts.map((text, index) => ({ text, index }));
  const wanted = candidates.filter(Boolean);
  if (options.length === 0 || wanted.length === 0) return null;

  const exactRules = [
    (o, c) => o.trim() === c.trim(),
    (o, c) => normalizeText(o) === normalizeText(c),
    (o, c) => stripAdminSuffix(o) === stripAdminSuffix(c),
  ];
  for (const rule of exactRules) {
    for (const candidate of wanted) {
      const hit = options.find((o) => rule(o.text, candidate));
      if (hit) return { index: hit.index, text: hit.text, exact: true };
    }
  }

  let best = null;
  const consider = (option, score) => {
    if (!best || score > best.score) best = { ...option, score };
  };
  for (const candidate of wanted) {
    const c = normalizeText(candidate);
    if (c.length < 2) continue;
    for (const option of options) {
      const o = normalizeText(option.text);
      if (!o) continue;
      if (o.includes(c) || (o.length >= 2 && c.includes(o))) {
        consider(option, 0.5 + 0.5 * (Math.min(o.length, c.length) / Math.max(o.length, c.length)));
        continue;
      }
      const score = similarity(o, c);
      if (score >= 0.5) consider(option, score * 0.9);
    }
  }
  return best ? { index: best.index, text: best.text, exact: false } : null;
}

/** 取文字里的第一个整数："2020年" -> 2020，"09月" -> 9。 */
export function firstNumber(text) {
  const match = String(text ?? "").match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** 在年份/月份下拉里找数字等于 n 的选项。 */
export function pickNumberOption(optionTexts, n) {
  const index = optionTexts.findIndex((text) => firstNumber(text) === n);
  return index >= 0 ? { index, text: optionTexts[index], exact: true } : null;
}

/** "2001-05-20" / "2001年5月" / "2001/05" -> [2001, 5, 20] / [2001, 5]。 */
export function parseDateParts(text) {
  return (String(text ?? "").match(/\d+/g) || []).map((n) => parseInt(n, 10));
}

/**
 * 可搜索下拉依次尝试的搜索关键词：先用完整值，搜不到再逐步放宽。
 * @param {string} value
 * @returns {string[]}
 */
export function searchKeywords(value) {
  const full = String(value ?? "").trim();
  if (!full) return [];
  const withoutBrackets = full.replace(/[（(【[].*?[）)】\]]/g, "").trim();
  const keywords = [full, withoutBrackets];
  if (withoutBrackets.length > 4) keywords.push(withoutBrackets.slice(0, 4));
  if (withoutBrackets.length > 2) keywords.push(withoutBrackets.slice(0, 2));
  return Array.from(new Set(keywords.filter(Boolean)));
}

/**
 * 把城市值拆成级联路径："广东省/深圳市"、"广东 深圳" -> ["广东省","深圳市"]；
 * 只写了"深圳"时返回 ["深圳"]，由级联填写逻辑自己去各省下面找。
 * @param {string|string[]} value
 * @returns {string[]}
 */
export function splitCascaderPath(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const tokens = String(value ?? "")
    .split(/[/／>\s,，、-]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  // "湖北省武汉市洪山区" 这种连着写的，按"省/市/区"这些后缀拆开。
  if (tokens.length === 1) {
    const parts = tokens[0].match(/.+?(特别行政区|自治区|自治州|省|市|区|县|盟|旗)/g);
    if (parts && parts.length > 1 && parts.join("") === tokens[0]) return parts;
  }
  return tokens;
}
