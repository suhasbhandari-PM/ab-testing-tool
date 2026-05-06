import { SetAttributeOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applySetAttribute(op: SetAttributeOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  if (el.getAttribute(op.attribute) === op.value) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  el.setAttribute(op.attribute, op.value);
  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
