// @vitest-environment jsdom
// 撤销时删掉插件本次添加的经历段：这是 SUBMIT_LIKE_BLACKLIST 里"删除"的唯一例外。
// 这里证明：用户原有的段、用户改过的段、不是"删除本条"的按钮，一律不点。
import { describe, it, expect, beforeAll } from "vitest";
import {
  getClickBlockReason,
  getDeleteEntryBlockReason,
  clickDeleteOfAddedEntry,
  hasOnlyPluginContent,
  readEntryValues,
  readShownText,
  safeClick,
  ClickBlockedError,
} from "../../src/content/filler/dom-actions.js";
import { undoFill, rememberPluginValues } from "../../src/content/filler/filler.js";

// vitest 的 jsdom 环境里 window 是个代理，事件构造时传 view: window 会报错；测试里去掉 view。
beforeAll(() => {
  for (const name of ["MouseEvent", "PointerEvent"]) {
    const Original = globalThis[name];
    globalThis[name] = class extends Original {
      constructor(type, { view, ...init } = {}) {
        super(type, init);
      }
    };
  }
});

const ENTRY = (id) => `
  <div class="apply-fields" id="${id}">
    <div class="fieldsHeader-Ab12c"><span class="fieldsDelete-Ab12c" id="${id}-delete"><i>🗑</i><span>删除本条</span></span></div>
    <div class="apply-field-Q2iJ7AtQGX string_info"><input class="name" /></div>
    <div class="apply-field-Q2iJ7AtQGX Select">
      <label class="sd-Input-container-1aB2c"><input class="level" readonly /><span class="sd-Input-display-value-9Xk2p"></span></label>
    </div>
    <label class="sd-Checkbox-container-7Yu2w"><input type="checkbox" class="current" />至今</label>
  </div>`;

function setup() {
  document.body.innerHTML = `<div class="apply-block">${ENTRY("original")}${ENTRY("added")}</div>`;
  const clicks = [];
  for (const id of ["original", "added"]) {
    const entry = document.getElementById(id);
    document.getElementById(`${id}-delete`).addEventListener("click", () => {
      clicks.push(id);
      entry.remove();
    });
  }
  const $ = (id) => document.getElementById(id);
  return { original: $("original"), added: $("added"), clicks, $ };
}

const deleteButton = (entry) => entry.querySelector('[class*="fieldsDelete"] span');
const setShown = (entry, text) => (entry.querySelector('[class*="display-value"]').textContent = text);

describe("readShownText / readEntryValues", () => {
  it("下拉选中的文字在 display-value 里（input.value 是空的），没有 display-value 时退回 value", () => {
    const { added } = setup();
    setShown(added, "英语");
    expect(readShownText(added.querySelector(".level"))).toBe("英语");
    added.querySelector(".name").value = "国家奖学金";
    expect(readShownText(added.querySelector(".name"))).toBe("国家奖学金");
    added.querySelector(".current").checked = true;
    expect(readEntryValues(added)).toEqual(["国家奖学金", "英语", "✓"]);
  });

  it("只有空值或插件填的值才算“只有插件的内容”", () => {
    const { added } = setup();
    const pluginValues = ["国家奖学金", "英语", ""];
    expect(hasOnlyPluginContent(added, pluginValues)).toBe(true); // 全空（撤销清空后）
    added.querySelector(".name").value = "国家奖学金";
    setShown(added, "英语");
    expect(hasOnlyPluginContent(added, pluginValues)).toBe(true); // 正是插件填的
    added.querySelector(".name").value = "国家奖学金（我改过）";
    expect(hasOnlyPluginContent(added, pluginValues)).toBe(false);
    added.querySelector(".name").value = "";
    added.querySelector(".current").checked = true; // 用户自己勾了"至今"
    expect(hasOnlyPluginContent(added, pluginValues)).toBe(false);
  });
});

describe("clickDeleteOfAddedEntry：黑名单“删除”的唯一例外", () => {
  it("普通的 safeClick 照样拦住“删除本条”（它不是 button 也拦）", async () => {
    const { added, clicks } = setup();
    expect(getClickBlockReason(deleteButton(added))).toMatch(/删除.*插件不会点击/);
    await expect(safeClick(deleteButton(added))).rejects.toBeInstanceOf(ClickBlockedError);
    expect(clicks).toEqual([]);
  });

  it("用户原有的段：不在本次添加记录里，绝不删除", async () => {
    const { original, added, clicks } = setup();
    const addedEntries = [{ entry: added, pluginValues: ["", "", ""] }];
    expect(getDeleteEntryBlockReason(deleteButton(original), original, addedEntries)).toMatch(/不是插件本次添加的/);
    await expect(clickDeleteOfAddedEntry(deleteButton(original), original, addedEntries)).rejects.toBeInstanceOf(
      ClickBlockedError
    );
    // 拿别的段的按钮冒充也不行
    await expect(clickDeleteOfAddedEntry(deleteButton(original), added, addedEntries)).rejects.toThrow(/不在这一段里/);
    expect(clicks).toEqual([]);
    expect(original.isConnected).toBe(true);
  });

  it("插件添加、但用户改过内容的段：不删除", async () => {
    const { added, clicks } = setup();
    const addedEntries = [{ entry: added, pluginValues: ["ACM 银牌", "", ""] }];
    added.querySelector(".name").value = "ACM 银牌（我改过）";
    await expect(clickDeleteOfAddedEntry(deleteButton(added), added, addedEntries)).rejects.toThrow(/不是插件填的内容/);
    expect(clicks).toEqual([]);
  });

  it("按钮文字不是“删除本条”（比如“删除全部”）不点", async () => {
    const { added, clicks } = setup();
    const button = deleteButton(added);
    button.textContent = "删除全部经历";
    const addedEntries = [{ entry: added, pluginValues: ["", "", ""] }];
    await expect(clickDeleteOfAddedEntry(button, added, addedEntries)).rejects.toThrow(/不是“删除本条”/);
    expect(clicks).toEqual([]);
  });

  it("插件本次添加、内容为空或只有插件填的值：点“删除本条”", async () => {
    const { added, original, clicks } = setup();
    added.querySelector(".name").value = "国家奖学金";
    const addedEntries = [{ entry: added, pluginValues: ["国家奖学金", "", ""] }];
    expect(getDeleteEntryBlockReason(deleteButton(added), added, addedEntries)).toBeNull();
    await clickDeleteOfAddedEntry(deleteButton(added), added, addedEntries);
    expect(clicks).toEqual(["added"]);
    expect(original.isConnected).toBe(true);
  });
});

describe("undoFill 和新增段", () => {
  const recordOf = (entry) => ({
    entry,
    arrayName: "awards",
    title: "获奖经历",
    index: 1,
    countEntries: () => document.querySelectorAll(".apply-fields").length,
    findDeleteButton: (e) => e.querySelector('[class*="fieldsDelete"]'),
  });

  it("只删插件添加且没被改过的段，用户原有的段和改过的段都留着", async () => {
    const { original, added, clicks } = setup();
    original.querySelector(".name").value = "用户原来填的";
    const record = recordOf(added);
    added.querySelector(".name").value = "插件填的";
    rememberPluginValues([record]);

    const results = await undoFill([], [record]);
    expect(clicks).toEqual(["added"]);
    expect(original.isConnected).toBe(true);
    expect(original.querySelector(".name").value).toBe("用户原来填的");
    expect(results).toEqual([
      expect.objectContaining({ controlType: "added-entry", status: "restored", sectionIndex: 1 }),
    ]);
  });

  it("用户改过插件添加的段：整段不删，在清单里请用户检查", async () => {
    const { added, clicks } = setup();
    const record = recordOf(added);
    added.querySelector(".name").value = "插件填的";
    rememberPluginValues([record]);
    added.querySelector(".name").value = "用户改过";

    const results = await undoFill([], [record]);
    expect(clicks).toEqual([]);
    expect(added.isConnected).toBe(true);
    expect(added.querySelector(".name").value).toBe("用户改过");
    expect(results[0]).toMatchObject({ status: "failed", reason: expect.stringMatching(/改动过/) });
  });
});
