/**
 * 本地存储封装：所有数据只放在 chrome.storage.local，不上传任何后端。
 *
 * 第 0 阶段先定义好读写接口，内部实现是最简单的直接透传，
 * 后续阶段可以在这里加缓存/迁移逻辑而不影响调用方。
 */

const KEYS = {
  RESUME_PROFILES: "resumeProfiles", // ResumeProfile[]
  ACTIVE_PROFILE_ID: "activeProfileId", // string
  APPLICATION_RECORDS: "applicationRecords", // ApplicationRecord[]
  AI_SETTINGS: "aiSettings", // { apiKey, baseUrl, model }
};

/**
 * @typedef {Object} ApplicationRecord 一条投递记录
 * @property {string} id
 * @property {string} company 公司
 * @property {string} position 岗位
 * @property {string} url 投递页面网址
 * @property {string} platform 平台标识（如 "moka"）
 * @property {string} submittedAt ISO 时间字符串
 */

/** @returns {Promise<import('../schema/resume.js').ResumeProfile[]>} */
export async function getResumeProfiles() {
  const { [KEYS.RESUME_PROFILES]: profiles } = await chrome.storage.local.get(
    KEYS.RESUME_PROFILES
  );
  return profiles ?? [];
}

/** @param {import('../schema/resume.js').ResumeProfile[]} profiles */
export async function saveResumeProfiles(profiles) {
  await chrome.storage.local.set({ [KEYS.RESUME_PROFILES]: profiles });
}

/** @returns {Promise<string|null>} */
export async function getActiveProfileId() {
  const { [KEYS.ACTIVE_PROFILE_ID]: id } = await chrome.storage.local.get(
    KEYS.ACTIVE_PROFILE_ID
  );
  return id ?? null;
}

/** @param {string} id */
export async function setActiveProfileId(id) {
  await chrome.storage.local.set({ [KEYS.ACTIVE_PROFILE_ID]: id });
}

/** @returns {Promise<ApplicationRecord[]>} */
export async function getApplicationRecords() {
  const { [KEYS.APPLICATION_RECORDS]: records } = await chrome.storage.local.get(
    KEYS.APPLICATION_RECORDS
  );
  return records ?? [];
}

/** @param {ApplicationRecord} record */
export async function appendApplicationRecord(record) {
  const records = await getApplicationRecords();
  records.push(record);
  await chrome.storage.local.set({ [KEYS.APPLICATION_RECORDS]: records });
}

/** @returns {Promise<{apiKey: string, baseUrl: string, model: string}>} */
export async function getAiSettings() {
  const { [KEYS.AI_SETTINGS]: settings } = await chrome.storage.local.get(
    KEYS.AI_SETTINGS
  );
  return settings ?? { apiKey: "", baseUrl: "", model: "" };
}

/** @param {{apiKey: string, baseUrl: string, model: string}} settings */
export async function saveAiSettings(settings) {
  await chrome.storage.local.set({ [KEYS.AI_SETTINGS]: settings });
}
