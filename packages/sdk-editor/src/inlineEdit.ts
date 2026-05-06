import { generateSelector } from "./selector";
import { postToParent } from "./bridge";

const SKIP_TAGS = new Set([
  "html", "body", "head", "script", "style", "meta", "link",
  "img", "input", "select", "textarea", "iframe", "svg", "canvas"
]);

let activeEl: HTMLElement | null = null;
let originalText = "";
let isActive = false;

function isEditorEl(el: Element): boolean {
  return typeof (el as HTMLElement).id === "string" && (el as HTMLElement).id.startsWith("ab-editor-");
}

function hasDirectText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0
  );
}

function commitEdit(): void {
  if (!activeEl) return;
  const newText = (activeEl.textContent ?? "").trim();
  activeEl.contentEditable = "false";
  activeEl.style.outline = "";
  activeEl.style.cursor = "";

  if (newText !== originalText.trim()) {
    const selector = generateSelector(activeEl).selector;
    postToParent({ type: "OPERATION_CREATED", operation: { type: "set_text", selector, text: newText } });
  }

  activeEl = null;
  originalText = "";
}

function cancelEdit(): void {
  if (!activeEl) return;
  activeEl.textContent = originalText;
  activeEl.contentEditable = "false";
  activeEl.style.outline = "";
  activeEl.style.cursor = "";
  activeEl = null;
  originalText = "";
}

function onDblClick(e: MouseEvent): void {
  if (!isActive) return;
  const target = e.target as Element;
  if (isEditorEl(target) || SKIP_TAGS.has(target.tagName.toLowerCase())) return;
  if (!hasDirectText(target)) return;

  e.preventDefault();
  e.stopPropagation();

  if (activeEl && activeEl !== target) commitEdit();

  activeEl = target as HTMLElement;
  originalText = activeEl.textContent ?? "";
  activeEl.contentEditable = "true";
  activeEl.style.outline = "2px solid #7c3aed";
  activeEl.style.cursor = "text";
  activeEl.focus();

  const range = document.createRange();
  range.selectNodeContents(activeEl);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!activeEl) return;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    commitEdit();
  } else if (e.key === "Escape") {
    cancelEdit();
  }
}

function onFocusOut(e: FocusEvent): void {
  if (!activeEl) return;
  const related = e.relatedTarget as Element | null;
  if (related && activeEl.contains(related)) return;
  setTimeout(() => {
    if (activeEl && document.activeElement !== activeEl) commitEdit();
  }, 80);
}

export function startInlineEdit(): void {
  if (isActive) return;
  isActive = true;
  document.addEventListener("dblclick", onDblClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusout", onFocusOut, true);
}

export function stopInlineEdit(): void {
  if (!isActive) return;
  isActive = false;
  cancelEdit();
  document.removeEventListener("dblclick", onDblClick, true);
  document.removeEventListener("keydown", onKeyDown, true);
  document.removeEventListener("focusout", onFocusOut, true);
}
