/**
 * 城市级联选择（Ant Design .ant-cascader）：点开 -> 逐级点选 -> 等浮层关闭 -> 回读。
 * 简历里只写了"深圳"这种不带省份的值时，像人一样挨个展开省份去找。
 */

import { safeClick, clickOutside, hover, isVisible, waitFor, waitForSettled } from "../dom-actions.js";
import { normalizeText, pickBestOption, splitCascaderPath, stripAdminSuffix } from "../option-match.js";
import { readSelectText, isSelectDisabled } from "./select.js";
import { filled, needsConfirmation, skipped, failed, restored, unchanged } from "./results.js";

function findDropdown() {
  const visible = Array.from(document.querySelectorAll(".ant-cascader-dropdown")).filter(isVisible);
  return visible.at(-1) || null;
}

function menus(dropdown) {
  return Array.from(dropdown?.querySelectorAll(".ant-cascader-menu") ?? []);
}

function menuItems(menu) {
  return Array.from(menu?.querySelectorAll(".ant-cascader-menu-item") ?? [])
    .filter((el) => !el.classList.contains("ant-cascader-menu-item-disabled"))
    .map((el) => ({
      el,
      text: (el.getAttribute("title") || el.textContent).trim(),
      expandable: el.classList.contains("ant-cascader-menu-item-expand"),
    }));
}

async function openDropdown(el) {
  if (findDropdown()) return findDropdown();
  await safeClick(el.querySelector(".ant-select-selector") || el);
  return waitFor(() => (menus(findDropdown()).length ? findDropdown() : null));
}

async function closeDropdown() {
  if (!findDropdown()) return;
  await clickOutside();
  await waitFor(() => !findDropdown(), { timeout: 2000 });
}

/** 点某一级的一项；非叶子节点要等下一级菜单出现。返回是否已经点到叶子。 */
async function clickItem(item, level) {
  await safeClick(item.el);
  if (!item.expandable) {
    await waitFor(() => !findDropdown(), { timeout: 2000 });
    return true;
  }
  const dropdown = findDropdown();
  await waitFor(
    () =>
      item.el.classList.contains("ant-cascader-menu-item-active") && menus(findDropdown()).length > level + 1
  );
  if (dropdown) await waitForSettled(dropdown, { quietMs: 60, timeout: 800 });
  return false;
}

/** 按完整路径逐级点选，路径比级数短时，下一级沿用最后一段（"北京" -> 北京市/北京市）。 */
async function followPath(tokens) {
  let exact = true;
  const path = [];
  for (let level = 0; level < 6; level += 1) {
    const items = menuItems(menus(findDropdown())[level]);
    const token = tokens[Math.min(level, tokens.length - 1)];
    let pick = pickBestOption(
      items.map((i) => i.text),
      [token]
    );
    if (!pick && level >= tokens.length && items.length === 1) pick = { index: 0, text: items[0].text, exact: true };
    if (!pick) return null;
    exact &&= pick.exact;
    path.push(pick.text);
    if (await clickItem(items[pick.index], level)) return { path, exact };
  }
  return null;
}

/** 只知道城市名：先看第一级有没有，没有就逐个展开第一级去第二级里找。 */
async function searchByCity(token) {
  const firstLevel = menuItems(menus(findDropdown())[0]);
  const direct = pickBestOption(
    firstLevel.map((i) => i.text),
    [token]
  );
  if (direct?.exact) return followPath([token]);

  let best = null;
  for (let index = 0; index < firstLevel.length; index += 1) {
    const parent = menuItems(menus(findDropdown())[0])[index];
    if (!parent?.expandable) continue;
    await clickItem(parent, 0);
    const children = menuItems(menus(findDropdown())[1]);
    const pick = pickBestOption(
      children.map((i) => i.text),
      [token]
    );
    if (pick?.exact) return followPath([parent.text, pick.text]);
    if (pick && !best) best = { parent: parent.text, child: pick.text };
  }
  if (best) {
    const result = await followPath([best.parent, best.child]);
    return result && { ...result, exact: false };
  }
  return null;
}

function lastSegment(text) {
  return text.split("/").at(-1).trim();
}

export async function fillCascader(el, value) {
  if (isSelectDisabled(el)) return failed("级联选择框是禁用状态");
  const tokens = splitCascaderPath(value);
  const wantedText = tokens.join(" / ");
  if (!(await openDropdown(el))) return failed("点开级联选择框后没有出现选项浮层");

  const result = tokens.length >= 2 ? await followPath(tokens) : await searchByCity(tokens[0]);
  await closeDropdown();
  if (!result) return skipped(`级联选项里找不到「${wantedText}」，没有填`);

  const now = readSelectText(el);
  if (normalizeText(lastSegment(now)) !== normalizeText(result.path.at(-1))) {
    return failed(`选了「${result.path.join(" / ")}」，但回读到的是「${now || "空"}」`);
  }
  const exactEnough =
    result.exact && stripAdminSuffix(result.path.at(-1)) === stripAdminSuffix(tokens.at(-1));
  if (exactEnough) return filled(now);
  return needsConfirmation(now, `简历里是「${wantedText}」，选了最接近的「${now}」`);
}

export const cascaderControl = {
  snapshot: (field) => ({ text: readSelectText(field.element) }),

  fill: (field, value) => fillCascader(field.element, value),

  async restore(field, snapshot) {
    const el = field.element;
    if (readSelectText(el) === snapshot.text) return unchanged();
    if (!snapshot.text) {
      const clear = el.querySelector(".ant-select-clear");
      if (!clear) return failed("级联选择框没有清空按钮，没法自动清空，请手动检查");
      hover(el);
      await safeClick(clear);
      await waitFor(() => !readSelectText(el), { timeout: 1000 });
      await closeDropdown();
      return readSelectText(el) ? failed("点了清空按钮但还有值") : restored();
    }
    const result = await fillCascader(
      el,
      snapshot.text.split("/").map((s) => s.trim())
    );
    return result.status === "filled" ? restored() : failed(result.reason);
  },
};
