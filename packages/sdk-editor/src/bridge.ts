import { Operation } from "../../shared-types/src";
import { executeOperations } from "../../dom-operations/src";
import { restoreAll, snapshotElement } from "./snapshot";
import { startPick, stopPick } from "./overlay";
import { startDragEdit, stopDragEdit } from "./dragdrop";
import { startInlineEdit, stopInlineEdit } from "./inlineEdit";
import { setPickModeActive, startLinkNavigation, stopLinkNavigation } from "./navigation";
import { generateSelector } from "./selector";

export type InboundMessage =
  | { type: "PING" }
  | { type: "PREVIEW_OPERATION"; operation: Operation }
  | { type: "RESET_PREVIEW" }
  | { type: "START_PICK" }
  | { type: "STOP_PICK" }
  | { type: "START_EDIT_MODE" }
  | { type: "STOP_EDIT_MODE" }
  | { type: "CAPTURE_SCREENSHOT"; requestId: string; viewport: "desktop" | "mobile"; width: number; height: number };

export type OutboundMessage =
  | {
      type: "EDITOR_BOOT";
      stage: "proxy-html" | "sdk-injecting" | "sdk-loaded" | "sdk-init-start" | "sdk-ready";
      detail?: string;
    }
  | { type: "EDITOR_READY" }
  | {
      type: "EDITOR_ERROR";
      phase: "init" | "runtime";
      message: string;
      stack?: string;
    }
  | { type: "NAVIGATE_PREVIEW"; url: string }
  | {
      type: "ELEMENT_SELECTED";
      selector: string;
      confidence: string;
      tagName: string;
      textContent: string;
      computedStyles: Record<string, string>;
      attributes: Record<string, string>;
      innerHTML: string;
      outerHTML: string;
      classList: string[];
      ancestors: Array<{ selector: string; label: string }>;
    }
  | { type: "OPERATION_CREATED"; operation: Operation }
  | { type: "SCREENSHOT_CAPTURED"; requestId: string; viewport: "desktop" | "mobile"; dataUrl?: string; error?: string };

export function postToParent(msg: OutboundMessage): void {
  window.parent.postMessage(msg, "*");
}

export function reportEditorError(error: unknown, phase: "init" | "runtime"): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  postToParent({ type: "EDITOR_ERROR", phase, message, stack });
  // Keep the browser console useful when the parent cannot surface the message.
  console.error(`[AB editor] ${phase} error`, error);
}

const STYLE_PROPS = [
  "color", "background-color", "background-image",
  "font-family", "font-size", "font-weight", "text-align", "line-height",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "border-radius", "border-top-width", "border-style", "border-color",
  "fill", "stroke", "display"
];

const COLOR_PROPS = new Set(["color", "background-color", "border-color", "fill", "stroke"]);

function rgbToHex(val: string): string {
  return val.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g, (_, r, g, b) =>
    "#" + [r, g, b].map((n: string) => parseInt(n).toString(16).padStart(2, "0")).join("")
  );
}

function captureStyles(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const result: Record<string, string> = {};
  for (const prop of STYLE_PROPS) {
    const raw = computed.getPropertyValue(prop).trim();
    result[prop] = COLOR_PROPS.has(prop) ? rgbToHex(raw) : raw;
  }
  return result;
}

function captureAttributes(el: Element | null): Record<string, string> {
  if (!el) {
    return {};
  }

  const names = ["src", "href", "alt", "title"];
  return Object.fromEntries(names.map((name) => [name, el.getAttribute(name) ?? ""]));
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = Array.from(el.classList).slice(0, 2).map((cls) => `.${cls}`).join("");
  return `${tag}${id}${classes}`;
}

function buildAncestorTrail(el: Element): Array<{ selector: string; label: string }> {
  const trail: Array<{ selector: string; label: string }> = [];
  let current: Element | null = el;

  while (current && current !== document.body && trail.length < 5) {
    const currentSelector = generateSelector(current).selector;
    trail.unshift({
      selector: currentSelector,
      label: describeElement(current)
    });
    current = current.parentElement;
  }

  return trail;
}

type Html2CanvasFn = (
  element: HTMLElement,
  options: {
    width: number;
    height: number;
    windowWidth: number;
    windowHeight: number;
    scrollX: number;
    scrollY: number;
    scale: number;
    useCORS: boolean;
    backgroundColor: string;
    logging: boolean;
  }
) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn;
  }
}

let html2CanvasLoadPromise: Promise<void> | null = null;

async function ensureHtml2CanvasLoaded(): Promise<void> {
  if (window.html2canvas) return;
  if (!html2CanvasLoadPromise) {
    html2CanvasLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-ab-html2canvas='1']");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Failed to load html2canvas")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.async = true;
      script.setAttribute("data-ab-html2canvas", "1");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(script);
    });
  }
  await html2CanvasLoadPromise;
}

async function captureScreenshot(width: number, height: number): Promise<string> {
  await ensureHtml2CanvasLoaded();
  if (!window.html2canvas) {
    throw new Error("Capture library unavailable");
  }

  window.scrollTo(0, 0);
  const canvas = await window.html2canvas(document.documentElement as HTMLElement, {
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    scale: 1,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false
  });
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function initBridge(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data as InboundMessage;
    if (!msg || typeof msg.type !== "string") return;

    switch (msg.type) {
      case "PING":
        postToParent({ type: "EDITOR_READY" });
        break;

      case "PREVIEW_OPERATION": {
        const op = msg.operation;
        const selector = "selector" in op ? op.selector : "sourceSelector" in op ? op.sourceSelector : null;
        if (selector) snapshotElement(selector);
        executeOperations([op]);
        break;
      }

      case "RESET_PREVIEW":
        restoreAll();
        break;

      case "START_PICK":
        setPickModeActive(true);
        startPick((result) => {
          const el = document.querySelector(result.selector);
          postToParent({
            type: "ELEMENT_SELECTED",
            selector: result.selector,
            confidence: result.confidence,
            tagName: result.tagName,
            textContent: (el?.textContent ?? "").trim().slice(0, 200),
            computedStyles: el ? captureStyles(el) : {},
            attributes: captureAttributes(el),
            innerHTML: el?.innerHTML ?? "",
            outerHTML: el?.outerHTML ?? "",
            classList: el ? Array.from(el.classList) : [],
            ancestors: el ? buildAncestorTrail(el) : []
          });
        });
        break;

      case "STOP_PICK":
        setPickModeActive(false);
        stopPick();
        break;

      case "START_EDIT_MODE":
        startDragEdit();
        startInlineEdit();
        startLinkNavigation();
        break;

      case "STOP_EDIT_MODE":
        stopDragEdit();
        stopInlineEdit();
        stopLinkNavigation();
        break;

      case "CAPTURE_SCREENSHOT":
        void captureScreenshot(msg.width, msg.height)
          .then((dataUrl) => {
            postToParent({
              type: "SCREENSHOT_CAPTURED",
              requestId: msg.requestId,
              viewport: msg.viewport,
              dataUrl
            });
          })
          .catch((error: unknown) => {
            const detail = error instanceof Error ? error.message : String(error);
            postToParent({
              type: "SCREENSHOT_CAPTURED",
              requestId: msg.requestId,
              viewport: msg.viewport,
              error: detail
            });
          });
        break;
    }
  });
}
