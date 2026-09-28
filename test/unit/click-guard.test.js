// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { getClickBlockReason, safeClick, ClickBlockedError } from "../../src/content/filler/dom-actions.js";
import { findAddEntryButton } from "../../src/content/filler/filler.js";

function dom(html) {
  document.body.innerHTML = html;
  return document.body;
}

describe("点击安全检查", () => {
  it("提交/保存/下一步/确认/投递/删除类按钮一律拒绝", () => {
    dom(`
      <button id="a">提交申请</button><button id="b"><span>保存草稿</span></button>
      <a href="#" id="c">下一步</a><div role="button" id="d">确认</div>
      <input type="button" id="e" value="立即投递" /><button id="f">删除这段经历</button>
    `);
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const target = document.getElementById(id);
      expect(getClickBlockReason(target.firstElementChild || target)).toMatch(/插件不会点击/);
    }
  });

  it("表单里没写 type 的按钮默认会提交表单，也拒绝", () => {
    dom(`<form><button id="add">+ 添加</button></form>`);
    expect(getClickBlockReason(document.getElementById("add"))).toMatch(/提交表单/);
  });

  it("添加按钮、下拉选项等普通元素允许点击", () => {
    dom(`<button type="button" id="add">+ 添加教育经历</button><div role="option" id="opt">确认中</div>`);
    expect(getClickBlockReason(document.getElementById("add"))).toBeNull();
    expect(getClickBlockReason(document.getElementById("opt"))).toBeNull();
  });

  it("Moka 的“预览并提交”按钮被拦截，一次点击事件都不会发出去", async () => {
    dom(`<button type="button" class="sd-Button-button-4Rt6y sd-Button-primary-8Uj2k" id="submit"><span>预览并提交</span></button>`);
    const button = document.getElementById("submit");
    const events = [];
    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      button.addEventListener(type, () => events.push(type));
    }
    expect(getClickBlockReason(button.firstElementChild)).toMatch(/预览并提交.*提交.*插件不会点击/);
    await expect(safeClick(button.firstElementChild)).rejects.toBeInstanceOf(ClickBlockedError);
    await expect(safeClick(button, { focus: true })).rejects.toBeInstanceOf(ClickBlockedError);
    expect(events).toEqual([]);
  });

  it("findAddEntryButton 跳过黑名单按钮", () => {
    const section = dom(`
      <button type="button">删除并新增</button>
      <button type="button" id="ok">+ 新增实习经历</button>
    `);
    expect(findAddEntryButton(section)?.id).toBe("ok");
  });
});
