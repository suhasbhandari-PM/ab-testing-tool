import { generateSelector } from "./selector";
import { postToParent } from "./bridge";

let dragSource: Element | null = null;
let indicator: HTMLDivElement | null = null;
let isActive = false;
let autoScrollFrame: number | null = null;
let autoScrollDeltaY = 0;

const SKIP_TAGS = new Set(["html", "body", "head", "script", "style", "meta", "link"]);
const AUTO_SCROLL_MARGIN_PX = 72;
const AUTO_SCROLL_MAX_STEP_PX = 28;

function isEditorEl(el: Element): boolean {
  return typeof (el as HTMLElement).id === "string" && (el as HTMLElement).id.startsWith("ab-editor-");
}

function isSkipped(el: Element): boolean {
  return SKIP_TAGS.has(el.tagName.toLowerCase()) || isEditorEl(el);
}

function createIndicator(): HTMLDivElement {
  const div = document.createElement("div");
  div.id = "ab-editor-drop-indicator";
  Object.assign(div.style, {
    position: "fixed",
    display: "none",
    height: "2px",
    background: "#7c3aed",
    pointerEvents: "none",
    zIndex: "2147483645",
    boxShadow: "0 0 6px rgba(124,58,237,0.6)"
  });
  document.body.appendChild(div);
  return div;
}

function getIndicator(): HTMLDivElement {
  if (!indicator) indicator = createIndicator();
  return indicator;
}

function getAutoScrollDelta(pointerY: number): number {
  if (pointerY < AUTO_SCROLL_MARGIN_PX) {
    const intensity = (AUTO_SCROLL_MARGIN_PX - pointerY) / AUTO_SCROLL_MARGIN_PX;
    return -Math.max(8, Math.round(AUTO_SCROLL_MAX_STEP_PX * intensity));
  }
  const lowerBound = window.innerHeight - AUTO_SCROLL_MARGIN_PX;
  if (pointerY > lowerBound) {
    const intensity = (pointerY - lowerBound) / AUTO_SCROLL_MARGIN_PX;
    return Math.max(8, Math.round(AUTO_SCROLL_MAX_STEP_PX * intensity));
  }
  return 0;
}

function runAutoScroll(): void {
  if (!autoScrollDeltaY) {
    autoScrollFrame = null;
    return;
  }
  window.scrollBy(0, autoScrollDeltaY);
  autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
}

function setAutoScroll(pointerY: number): void {
  autoScrollDeltaY = getAutoScrollDelta(pointerY);
  if (autoScrollDeltaY && autoScrollFrame === null) {
    autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  }
  if (!autoScrollDeltaY && autoScrollFrame !== null) {
    window.cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
}

function stopAutoScroll(): void {
  autoScrollDeltaY = 0;
  if (autoScrollFrame !== null) {
    window.cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
}

function onMouseOver(e: MouseEvent): void {
  if (!isActive) return;
  const target = e.target as HTMLElement;
  if (isSkipped(target)) return;
  target.draggable = true;
}

function onMouseOut(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!isSkipped(target)) target.draggable = false;
}

function onDragStart(e: DragEvent): void {
  const target = e.target as Element;
  if (isSkipped(target)) { e.preventDefault(); return; }
  dragSource = target;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "ab-drag");
  }
  setTimeout(() => { (target as HTMLElement).style.opacity = "0.4"; }, 0);
}

function onDragOver(e: DragEvent): void {
  e.preventDefault();
  setAutoScroll(e.clientY);
  if (!dragSource) return;
  const target = e.target as Element;
  if (isSkipped(target) || target === dragSource || dragSource.contains(target)) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  const rect = target.getBoundingClientRect();
  const isBefore = e.clientY < rect.top + rect.height / 2;
  const ind = getIndicator();
  Object.assign(ind.style, {
    display: "block",
    top: `${isBefore ? rect.top - 1 : rect.bottom - 1}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`
  });
}

function onDragEnd(_e: DragEvent): void {
  stopAutoScroll();
  if (dragSource) {
    (dragSource as HTMLElement).style.opacity = "";
    dragSource = null;
  }
  getIndicator().style.display = "none";
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  if (!dragSource) return;

  const target = e.target as Element;
  if (isSkipped(target) || target === dragSource || dragSource.contains(target)) {
    onDragEnd(e);
    return;
  }

  const rect = target.getBoundingClientRect();
  const isBefore = e.clientY < rect.top + rect.height / 2;

  const sourceSelector = generateSelector(dragSource).selector;
  const targetSelector = generateSelector(target).selector;

  const operation = isBefore
    ? { type: "move_before" as const, sourceSelector, targetSelector }
    : { type: "move_after" as const, sourceSelector, targetSelector };

  // Apply visually immediately
  if (isBefore) {
    target.parentNode?.insertBefore(dragSource, target);
  } else {
    target.parentNode?.insertBefore(dragSource, target.nextSibling);
  }

  postToParent({ type: "OPERATION_CREATED", operation });
  onDragEnd(e);
}

export function startDragEdit(): void {
  if (isActive) return;
  isActive = true;
  document.addEventListener("mouseover", onMouseOver);
  document.addEventListener("mouseout", onMouseOut);
  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("dragend", onDragEnd);
  document.addEventListener("drop", onDrop);
}

export function stopDragEdit(): void {
  if (!isActive) return;
  isActive = false;
  stopAutoScroll();
  document.removeEventListener("mouseover", onMouseOver);
  document.removeEventListener("mouseout", onMouseOut);
  document.removeEventListener("dragstart", onDragStart);
  document.removeEventListener("dragover", onDragOver);
  document.removeEventListener("dragend", onDragEnd);
  document.removeEventListener("drop", onDrop);
  indicator?.remove();
  indicator = null;
  dragSource = null;
}
