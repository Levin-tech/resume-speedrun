/**
 * 扫描器：遍历页面 DOM，找出所有"看起来像表单控件"的元素，
 * 输出成统一的 FormField 描述，交给 matcher 去识别每个字段对应简历哪一项。
 */

let fieldCounter = 0;

/**
 * @typedef {Object} FormField
 * @property {string} id 扫描器生成的临时 id
 * @property {'text'|'textarea'|'select'|'searchable-select'|'date'|'date-range-group'|'cascader'|'radio'|'checkbox'} controlType
 * @property {string} label 控件关联的文案标签
 * @property {HTMLElement} element 控件根节点
 * @property {HTMLElement} [container] 控件所在的重复区块容器
 * @property {string} sectionTitle 所在区块标题（如"教育背景"）
 * @property {number} sectionIndex 在重复区块中是第几段（从 0 开始）
 * @property {boolean} required 是否必填
 * @property {string[]} options 选项文字（能拿到的话）
 * @property {string} placeholder
 */

/**
 * 扫描传入的根节点，返回本次识别到的所有表单控件。
 * @param {ParentNode} [root]
 * @returns {FormField[]}
 */
export function scanFormFields(root = document) {
  fieldCounter = 0;
  const fields = [];

  const roots = collectRoots(root);
  for (const r of roots) {
    fields.push(...scanRoot(r));
  }

  return fields;
}

function collectRoots(root) {
  const roots = [root];
  try {
    const iframes = root.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument;
        if (doc) roots.push(doc);
      } catch {
        // cross-origin, skip
      }
    }
  } catch {
    // no querySelectorAll on root
  }
  return roots;
}

function scanRoot(root) {
  const fields = [];

  scanNativeInputs(root, fields);
  scanNativeTextareas(root, fields);
  scanNativeSelects(root, fields);
  scanAntSelects(root, fields);
  scanAntDatePickers(root, fields);
  scanAntCascaders(root, fields);
  scanAntRadioGroups(root, fields);
  scanAntCheckboxGroups(root, fields);
  scanDateRangeGroups(root, fields);

  // Shadow DOM: scan open shadow roots
  scanShadowRoots(root, fields);

  return fields;
}

function scanShadowRoots(root, fields) {
  try {
    const allElements = root.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot) {
        fields.push(...scanRoot(el.shadowRoot));
      }
    }
  } catch {
    // skip
  }
}

function nextId() {
  return `scan-${++fieldCounter}`;
}

function scanNativeInputs(root, fields) {
  const inputs = root.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], input:not([type])'
  );
  for (const input of inputs) {
    if (isHiddenOrInvisible(input)) continue;
    // skip inputs inside ant-design components (they have their own scanning)
    if (isInsideAntComponent(input)) continue;
    fields.push(buildField(input, "text", root));
  }
}

function scanNativeTextareas(root, fields) {
  const textareas = root.querySelectorAll("textarea");
  for (const ta of textareas) {
    if (isHiddenOrInvisible(ta)) continue;
    if (isInsideAntComponent(ta)) continue;
    fields.push(buildField(ta, "textarea", root));
  }
}

function scanNativeSelects(root, fields) {
  const selects = root.querySelectorAll("select");
  for (const select of selects) {
    if (isHiddenOrInvisible(select)) continue;
    const opts = Array.from(select.options)
      .map((o) => o.textContent.trim())
      .filter((t) => t && t !== "请选择");
    fields.push(buildField(select, "select", root, { options: opts }));
  }
}

function scanAntSelects(root, fields) {
  const selectors = root.querySelectorAll(".ant-select");
  for (const wrapper of selectors) {
    if (isHiddenOrInvisible(wrapper)) continue;
    // Skip if it's inside a date picker or cascader
    if (wrapper.closest(".ant-picker") || wrapper.closest(".ant-cascader")) continue;

    const isSearchable = wrapper.classList.contains("ant-select-show-search");
    const controlType = isSearchable ? "searchable-select" : "select";

    // Don't skip readonly selects - component library selects are often readonly
    fields.push(buildField(wrapper, controlType, root));
  }
}

function scanAntDatePickers(root, fields) {
  const pickers = root.querySelectorAll(".ant-picker");
  for (const picker of pickers) {
    if (isHiddenOrInvisible(picker)) continue;
    if (picker.closest(".ant-cascader")) continue;
    fields.push(buildField(picker, "date", root));
  }
}

function scanAntCascaders(root, fields) {
  const cascaders = root.querySelectorAll(".ant-cascader");
  for (const cascader of cascaders) {
    if (isHiddenOrInvisible(cascader)) continue;
    fields.push(buildField(cascader, "cascader", root));
  }
}

function scanAntRadioGroups(root, fields) {
  const groups = root.querySelectorAll(".ant-radio-group");
  for (const group of groups) {
    if (isHiddenOrInvisible(group)) continue;
    const opts = Array.from(group.querySelectorAll(".ant-radio-wrapper"))
      .map((w) => w.textContent.trim())
      .filter(Boolean);
    fields.push(buildField(group, "radio", root, { options: opts }));
  }
}

function scanAntCheckboxGroups(root, fields) {
  const groups = root.querySelectorAll(".ant-checkbox-group");
  for (const group of groups) {
    if (isHiddenOrInvisible(group)) continue;
    const opts = Array.from(group.querySelectorAll(".ant-checkbox-wrapper"))
      .map((w) => w.textContent.trim())
      .filter(Boolean);
    fields.push(buildField(group, "checkbox", root, { options: opts }));
  }
}

/**
 * 识别拆分式"年/月—年/月"下拉组：相邻的 4 个年月下拉识别成一组，
 * 并关联"至今"勾选框。
 */
function scanDateRangeGroups(root, fields) {
  const dateRangeContainers = root.querySelectorAll(".date-range-control, .date-range");
  for (const container of dateRangeContainers) {
    if (isHiddenOrInvisible(container)) continue;

    // 查找容器内的 select 组件（可能是原生或 ant-select）
    const selects = container.querySelectorAll(".ant-select, select");
    if (selects.length < 4) continue;

    // 查找至今复选框
    const checkbox = container.querySelector('.ant-checkbox-wrapper, input[type="checkbox"]');

    fields.push(
      buildField(container, "date-range-group", root, {
        options: [],
        subElements: {
          startYear: selects[0],
          startMonth: selects[1],
          endYear: selects[2],
          endMonth: selects[3],
          isCurrent: checkbox || null,
        },
      })
    );
  }
}

function buildField(element, controlType, root, extra = {}) {
  const label = extractLabel(element, root);
  const sectionInfo = extractSectionInfo(element);
  const required = isRequired(element);
  const placeholder = extractPlaceholder(element);

  return {
    id: nextId(),
    controlType,
    label,
    element,
    container: sectionInfo.container,
    sectionTitle: sectionInfo.title,
    sectionIndex: sectionInfo.index,
    required,
    options: extra.options || [],
    placeholder,
    ...(extra.subElements ? { subElements: extra.subElements } : {}),
  };
}

/**
 * 提取控件关联的标签文字。按优先级：
 * 1. form-item 的 label
 * 2. aria-label / aria-labelledby
 * 3. placeholder
 * 4. 前方最近的说明文字
 */
function extractLabel(element, root) {
  // 1. 查找 Ant Design form-item label
  const formItem = element.closest(".ant-form-item, .field, .ant-card");
  if (formItem) {
    const labelEl = formItem.querySelector(
      ".ant-form-item-label > label, .field-label, label.field-label"
    );
    if (labelEl) {
      const text = labelEl.textContent.trim().replace(/[：:*]$/g, "").trim();
      if (text) return text;
    }
  }

  // Walk up to find the nearest parent that contains a label
  let parent = element.parentElement;
  while (parent) {
    const label = parent.querySelector("label, .field-label");
    if (label && label !== element && !element.contains(label)) {
      const text = label.textContent.trim().replace(/[：:*]$/g, "").trim();
      if (text) return text;
    }
    if (parent.classList?.contains("field") || parent.classList?.contains("ant-form-item")) break;
    parent = parent.parentElement;
  }

  // 2. aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // aria-labelledby
  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const doc = root.ownerDocument || root;
    const refEl = doc.getElementById(ariaLabelledBy);
    if (refEl) return refEl.textContent.trim();
  }

  // 3. HTML label[for]
  const id = element.id || element.getAttribute("data-testid");
  if (id) {
    const doc = root.ownerDocument || root;
    try {
      const labelFor = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (labelFor) return labelFor.textContent.trim().replace(/[：:*]$/g, "").trim();
    } catch {
      // skip
    }
  }

  // 4. placeholder
  const ph = extractPlaceholder(element);
  if (ph && ph !== "请选择" && ph !== "请输入") return ph;

  // 5. Previous sibling text
  const prev = element.previousElementSibling;
  if (prev && prev.tagName !== "INPUT" && prev.tagName !== "SELECT") {
    const text = prev.textContent.trim().replace(/[：:*]$/g, "").trim();
    if (text && text.length < 20) return text;
  }

  return "";
}

function extractPlaceholder(element) {
  const ph = element.getAttribute("placeholder");
  if (ph) return ph.trim();

  // Ant Design select placeholder
  const selPlaceholder = element.querySelector(".ant-select-selection-placeholder");
  if (selPlaceholder) return selPlaceholder.textContent.trim();

  const input = element.querySelector("input[placeholder]");
  if (input) return input.getAttribute("placeholder").trim();

  return "";
}

/**
 * 判断控件所在的区块标题和在重复区块中的序号。
 */
function extractSectionInfo(element) {
  let container = null;
  let title = "";
  let index = 0;

  // 查找 Ant Design Card 区块
  const card = element.closest(".ant-card");
  if (card) {
    const cardTitle = card.querySelector(".ant-card-head-title");
    if (cardTitle) title = cardTitle.textContent.trim();
  }

  // 查找可重复区块
  const repeatableEntry = element.closest(".repeatable-entry, [data-testid*='entry']");
  if (repeatableEntry) {
    container = repeatableEntry.parentElement;

    // 判断是第几段
    const testId = repeatableEntry.getAttribute("data-testid") || "";
    const match = testId.match(/-(\d+)$/);
    if (match) {
      index = parseInt(match[1], 10);
    } else if (container) {
      const siblings = container.querySelectorAll(".repeatable-entry, [data-testid*='entry']");
      index = Array.from(siblings).indexOf(repeatableEntry);
    }
  }

  return { container, title, index };
}

function isRequired(element) {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") {
    return true;
  }

  // Check for red asterisk in label
  const formItem = element.closest(".ant-form-item, .field");
  if (formItem) {
    const asterisk = formItem.querySelector(".ant-form-item-required, .required");
    if (asterisk) return true;
    const labelEl = formItem.querySelector("label, .field-label");
    if (labelEl && /\*/.test(labelEl.textContent)) return true;
  }

  return false;
}

function isHiddenOrInvisible(el) {
  if (!el) return true;
  if (el.offsetParent === null && el.style?.position !== "fixed") {
    // could be hidden, but also could be in shadow DOM; check display
    const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
    if (style && (style.display === "none" || style.visibility === "hidden")) return true;
  }
  if (el.hasAttribute("hidden")) return true;
  const type = el.getAttribute("type");
  if (type === "hidden") return true;
  return false;
}

function isInsideAntComponent(el) {
  return !!(
    el.closest(".ant-select") ||
    el.closest(".ant-picker") ||
    el.closest(".ant-cascader") ||
    el.closest(".ant-input-number")
  );
}

const SUBMIT_BLACKLIST = ["提交", "保存", "下一步", "确认", "投递", "删除", "移除", "确定投递"];

/**
 * 在页面中定位某个重复区块的"添加/新增"按钮。
 * @param {HTMLElement} sectionContainer
 * @returns {HTMLElement|null}
 */
export function findAddEntryButton(sectionContainer) {
  if (!sectionContainer) return null;

  const buttons = sectionContainer.querySelectorAll("button, .ant-btn");
  const addPatterns = ["添加", "新增", "增加", "+ 添加", "+添加"];

  for (const btn of buttons) {
    const text = btn.textContent.trim();
    const isAdd = addPatterns.some((p) => text.includes(p));
    if (!isAdd) continue;
    const isBlacklisted = SUBMIT_BLACKLIST.some((b) => text.includes(b));
    if (isBlacklisted) continue;
    return btn;
  }
  return null;
}

/**
 * 导出诊断报告用：获取控件的精简 DOM 结构信息（不含 value）。
 * @param {HTMLElement} element
 * @returns {object}
 */
export function getElementDigest(element) {
  if (!element) return null;
  return {
    tagName: element.tagName?.toLowerCase() || "",
    className: element.className || "",
    role: element.getAttribute("role") || "",
    type: element.getAttribute("type") || "",
    dataTestId: element.getAttribute("data-testid") || "",
    ariaLabel: element.getAttribute("aria-label") || "",
    depth: getDepth(element),
  };
}

function getDepth(el) {
  let depth = 0;
  let current = el;
  while (current.parentElement) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}
