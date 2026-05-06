import { SetTextOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applySetText(op: SetTextOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  const hasLineBreaks = op.text.includes("\n");

  if (!hasLineBreaks && el.textContent === op.text) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  if (hasLineBreaks) {
    // Convert \n to <br> — escape other HTML to prevent injection
    const escaped = op.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    el.innerHTML = escaped;
  } else {
    el.textContent = op.text;
  }
  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
