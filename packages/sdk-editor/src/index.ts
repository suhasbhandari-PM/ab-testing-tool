import { initBridge, postToParent, reportEditorError } from "./bridge";
import { startDragEdit } from "./dragdrop";
import { startInlineEdit } from "./inlineEdit";
import { startLinkNavigation } from "./navigation";

export function initEditor(): void {
  try {
    postToParent({ type: "EDITOR_BOOT", stage: "sdk-init-start" });
    initBridge();
    startDragEdit();
    startInlineEdit();
    startLinkNavigation();
    postToParent({ type: "EDITOR_BOOT", stage: "sdk-ready" });
    postToParent({ type: "EDITOR_READY" });
  } catch (error) {
    reportEditorError(error, "init");
  }
}

export { generateSelector } from "./selector";
export { snapshotElement, restoreAll } from "./snapshot";
export { startPick, stopPick } from "./overlay";
export { executeOperations } from "../../dom-operations/src";

// Auto-initialize when loaded as a plain script tag
window.addEventListener("error", (event) => {
  const file = event.filename ?? "";
  if (file.includes("/dist/sdk-editor.iife.js")) {
    reportEditorError(event.error ?? event.message ?? "Editor runtime error", "runtime");
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (reason instanceof Error && typeof reason.stack === "string" && reason.stack.includes("/dist/sdk-editor.iife.js")) {
    reportEditorError(reason, "runtime");
  }
});

initEditor();
