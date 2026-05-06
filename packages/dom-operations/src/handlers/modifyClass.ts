import { ModifyClassOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applyModifyClass(op: ModifyClassOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  const classNames = op.classes.split(/\s+/).filter(Boolean);
  if (classNames.length === 0) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  if (op.action === "add") {
    if (classNames.every(c => el.classList.contains(c))) {
      return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
    }
  } else if (op.action === "remove") {
    if (classNames.every(c => !el.classList.contains(c))) {
      return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
    }
  }

  for (const className of classNames) {
    el.classList[op.action](className);
  }

  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
