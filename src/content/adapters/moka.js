/**
 * Moka（mokahr.com）平台适配器。页面结构详见 docs/platforms/moka.md：
 *
 *   div.apply-blocks > div.apply-block（区块）> [class*=blockTitle]（区块标题，可重复区块里有"添加"）
 *     > div.apply-fields（一段经历一组）> div.apply-field（一个字段，类名里带字段类型）
 *
 * Moka 自研组件库（sd- 前缀）的类名带 CSS Modules 哈希后缀（如 sd-Input-input-10L0t、
 * apply-field-Q2iJ7AtQGX），所以一律按前缀匹配，不写死哈希。
 * 字段类型直接看 apply-field 的类名，不用猜：扫描结果直接交给 filler 的 Moka 控件处理器。
 */

const HOST = /(^|\.)moka(hr)?\.com$/;

/** apply-field 的类型类名 -> 扫描结果的控件类型（date_info 按输入框个数再细分）。 */
const FIELD_TYPES = {
  string_info: "text",
  text_info: "textarea",
  Select: "select",
  date_info: "date_info",
  day_info: "date",
  location_info: "cascader",
  file_upload: "upload",
  attachment_upload: "upload",
  confirm_info: "confirm",
};

const SKIP_REASONS = {
  upload: "附件/照片请你自己上传，插件不碰文件",
  confirm: "声明/确认项请你自己阅读后勾选",
  unknown: "暂不支持这种控件，请手动填写",
};

const SELECT_INPUT = '[class*="sd-Select-container"] input';
const OVERLAY = '[class*="sd-Dropdown-container"], [class*="sd-Dropdown-dropdown"], [class*="menu-wrapper"]';
const ADD_WORDS = /添加|新增/;

/**
 * 元素是不是带某个基础类名（本身，或者后面接一段哈希）。"apply-field" 不能误认
 * "apply-fields"，也不能误认 "apply-field-title" 这种普通子类名，所以哈希部分要求
 * 是一段不含"-"、且混有大写/数字/下划线的字符。
 */
export function hasClassBase(el, base) {
  return Array.from(el.classList).some((token) => {
    if (token === base) return true;
    if (!token.startsWith(`${base}-`)) return false;
    const hash = token.slice(base.length + 1);
    return /^[A-Za-z0-9_]{4,}$/.test(hash) && /[A-Z0-9_]/.test(hash);
  });
}

function findByClassBase(root, base) {
  const all = Array.from(root.querySelectorAll(`[class*="${base}"]`)).filter((el) => hasClassBase(el, base));
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

function isHidden(el) {
  if (el.hidden) return true;
  const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
  return !!style && (style.display === "none" || style.visibility === "hidden");
}

/** 区块标题里文字含"添加/新增"的最里层元素；事件会冒泡到真正处理点击的那层。 */
function findAddButton(block) {
  const scope = block.querySelector('[class*="blockTitle"]');
  if (!scope) return null;
  const hits = Array.from(scope.querySelectorAll("*")).filter(
    (el) => ADD_WORDS.test(el.textContent) && el.textContent.trim().length <= 12
  );
  return hits.find((el) => !hits.some((other) => other !== el && el.contains(other))) ?? null;
}

function blockTitle(block, addButton) {
  const title = block.querySelector('[class*="blockTitle"]');
  if (!title) return "";
  return title.textContent
    .replace(addButton?.textContent ?? "", "")
    .replace(/[+＋*＊]/g, "")
    .trim();
}

function fieldLabel(fieldEl) {
  const title = Array.from(fieldEl.querySelectorAll('[class*="title"]')).find((el) => !el.closest(OVERLAY));
  if (!title) return "";
  const clone = title.cloneNode(true);
  clone.querySelectorAll('[class*="required-asterisk"]').forEach((el) => el.remove());
  return clone.textContent.replace(/[*＊:：]/g, "").trim();
}

// 真实页面上类型类名同样带 CSS Modules 哈希后缀（如 string_info-UOJxKN5mtC、Select-oqOV0aGogs）。
function fieldType(fieldEl) {
  const classes = Array.from(fieldEl.classList);
  const type = Object.keys(FIELD_TYPES).find((t) => classes.some((c) => c === t || c.startsWith(`${t}-`)));
  return type ? FIELD_TYPES[type] : "unknown";
}

const visibleInputs = (root, selector) => Array.from(root.querySelectorAll(selector)).filter((el) => !isHidden(el));

/** 手机号码/证件号码前面有个区号/证件类型小下拉，号码要填在后面那个普通输入框。 */
function plainInput(fieldEl) {
  return visibleInputs(fieldEl, 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])')
    .filter((input) => !input.closest('[class*="sd-Select-container"]'))
    .at(-1);
}

function currentCheckbox(fieldEl) {
  const boxes = Array.from(fieldEl.querySelectorAll('[class*="sd-Checkbox"]'));
  return boxes.find((box) => /至今/.test(box.textContent) && !boxes.some((o) => o !== box && o.contains(box))) ?? null;
}

/** 把一个 apply-field 描述成扫描结果（FormField），控件类型、要操作的输入框都在这里定好。 */
function describeField(fieldEl) {
  let controlType = fieldType(fieldEl);
  let subElements = null;
  let skipReason = SKIP_REASONS[controlType] ?? "";

  if (controlType === "text") {
    const input = plainInput(fieldEl);
    // 学校名称/专业名称这类 string_info 里带 sd-Dropdown：输入后要点选联想候选。
    if (fieldEl.querySelector('[class*="sd-Dropdown"]')) controlType = "suggest";
    subElements = { input };
  } else if (controlType === "textarea") {
    subElements = { input: visibleInputs(fieldEl, "textarea")[0] ?? plainInput(fieldEl) };
  } else if (controlType === "select" || controlType === "date" || controlType === "cascader") {
    subElements = { input: visibleInputs(fieldEl, "input:not([type='checkbox'])")[0] };
  } else if (controlType === "date_info") {
    const selects = visibleInputs(fieldEl, SELECT_INPUT);
    if (selects.length >= 4) {
      controlType = "date-range-group";
      const [startYear, startMonth, endYear, endMonth] = selects;
      subElements = { startYear, startMonth, endYear, endMonth, isCurrent: currentCheckbox(fieldEl) };
    } else if (selects.length === 2) {
      controlType = "year-month";
      subElements = { year: selects[0], month: selects[1] };
    } else {
      controlType = "unknown";
      skipReason = SKIP_REASONS.unknown;
    }
  }
  if (subElements && Object.entries(subElements).some(([key, el]) => key !== "isCurrent" && !el)) {
    controlType = "unknown";
    skipReason = SKIP_REASONS.unknown;
    subElements = null;
  }

  const firstInput = fieldEl.querySelector("input, textarea");
  return {
    id: "",
    kit: "moka",
    controlType,
    label: fieldLabel(fieldEl),
    element: fieldEl,
    required: !!fieldEl.querySelector('[class*="required-asterisk"]'),
    options: [],
    placeholder: firstInput?.getAttribute("placeholder")?.trim() ?? "",
    ...(subElements ? { subElements } : {}),
    ...(skipReason ? { skipReason } : {}),
  };
}

function listBlocks(root) {
  return findByClassBase(root, "apply-block")
    .filter((block) => !isHidden(block))
    .map((block) => {
      const addButton = findAddButton(block);
      const groups = findByClassBase(block, "apply-fields").filter((g) => !isHidden(g));
      return { block, addButton, groups, title: blockTitle(block, addButton) };
    });
}

/** @type {import('./adapter-interface.js').PlatformAdapter} */
export const mokaAdapter = {
  id: "moka",

  detect() {
    return (
      HOST.test(location.hostname) ||
      !!document.querySelector('[class*="apply-blocks"] [class*="apply-field"]')
    );
  },

  /** Moka 上的叫法，标签文字完全一致才用（只用于经历区块外的字段）。 */
  getFieldSelectors() {
    return {
      "basic.currentCity": ["所在地"],
      "basic.workYears": ["工作经验"],
      "derived.highestDegree": ["最高学历"],
      "derived.latestMajor": ["最近毕业专业"],
      "derived.graduationDate": ["毕业时间"],
      "derived.currentTitle": ["目前职位"],
      "expectation.cities": ["意向工作城市"],
    };
  },

  /**
   * 直接按 Moka 的页面结构扫描：apply-field 的类型类名决定控件类型，blockTitle 决定
   * 区块，apply-fields 的顺序决定第几段。一个 apply-field 都没找到时返回空数组，
   * 由 scanner 退回通用扫描。
   * @param {ParentNode} root
   * @returns {import('../scanner/scanner.js').FormField[]}
   */
  scanFields(root) {
    const fields = [];
    for (const { block, addButton, groups, title } of listBlocks(root)) {
      const repeatable = !!addButton || groups.length > 1;
      groups.forEach((group, index) => {
        for (const fieldEl of findByClassBase(group, "apply-field")) {
          if (isHidden(fieldEl)) continue;
          fields.push({
            ...describeField(fieldEl),
            container: repeatable ? block : null,
            sectionTitle: title,
            sectionIndex: index,
          });
        }
      });
    }
    return fields;
  },

  /**
   * 带"添加"按钮的区块（包括一段都还没有、只有标题和"添加"的区块），
   * 给 filler 按简历段数补齐用。
   * @param {ParentNode} root
   */
  getRepeatableSections(root) {
    return listBlocks(root)
      .filter(({ addButton }) => addButton)
      .map(({ block, title }) => ({
        title,
        container: block,
        countEntries: () => findByClassBase(block, "apply-fields").length,
        findAddButton: () => findAddButton(block),
      }));
  },
};
