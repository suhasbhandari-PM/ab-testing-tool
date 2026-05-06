import { SetStyleOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applySetStyle(op: SetStyleOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  const htmlEl = el as HTMLElement;
  const entries = Object.entries(op.styleMap);

  const allMatch = entries.every(([prop, value]) => htmlEl.style.getPropertyValue(prop) === value);
  if (allMatch && entries.length > 0) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  for (const [prop, value] of entries) {
    htmlEl.style.setProperty(prop, value);
  }
  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
