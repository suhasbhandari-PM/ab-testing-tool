import { ToggleVisibilityOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applyToggleVisibility(op: ToggleVisibilityOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector) as HTMLElement | null;
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  if (op.action === "hide") {
    if (el.style.display === "none") {
      return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
    }
    el.style.setProperty("display", "none");
  } else {
    if (el.style.display !== "none") {
      return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
    }
    el.style.removeProperty("display");
  }

  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
