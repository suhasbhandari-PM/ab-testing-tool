import { generateSelector, SelectorResult } from "./selector";

type SelectCallback = (result: SelectorResult & { tagName: string }) => void;

let isActive = false;
let highlightBox: HTMLDivElement | null = null;
let toolbar: HTMLDivElement | null = null;
let onSelectCallback: SelectCallback | null = null;

function createHighlightBox(): HTMLDivElement {
  const div = document.createElement("div");
  div.id = "ab-editor-highlight";
  Object.assign(div.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483646",
    outline: "2px solid #7c3aed",
    backgroundColor: "rgba(124,58,237,0.08)",
    transition: "top 0.05s, left 0.05s, width 0.05s, height 0.05s",
    boxSizing: "border-box"
  });
  return div;
}

function createToolbar(): HTMLDivElement {
  const div = document.createElement("div");
  div.id = "ab-editor-toolbar";
  Object.assign(div.style, {
    position: "fixed",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "#1e1b4b",
    color: "#e0e7ff",
    padding: "8px 18px",
    borderRadius: "20px",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    pointerEvents: "none"
  });
  div.textContent = "Click an element to select it  ·  Esc to cancel";
  return div;
}

function onMouseMove(e: MouseEvent): void {
  if (!highlightBox) return;
  const target = e.target as Element;
  if (target.id && target.id.startsWith("ab-editor-")) return;
  const rect = target.getBoundingClientRect();
  Object.assign(highlightBox.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
}

function onClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const target = e.target as Element;
  if (target.id && target.id.startsWith("ab-editor-")) return;
  const result = generateSelector(target);
  const cb = onSelectCallback; // save before stopPick clears it
  stopPick();
  cb?.({ ...result, tagName: target.tagName.toLowerCase() });
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") stopPick();
}

export function startPick(onSelect: SelectCallback): void {
  if (isActive) stopPick();
  isActive = true;
  onSelectCallback = onSelect;

  highlightBox = createHighlightBox();
  toolbar = createToolbar();
  document.body.appendChild(highlightBox);
  document.body.appendChild(toolbar);

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown);
}

export function stopPick(): void {
  if (!isActive) return;
  isActive = false;
  onSelectCallback = null;

  highlightBox?.remove();
  toolbar?.remove();
  highlightBox = null;
  toolbar = null;

  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown);
}
