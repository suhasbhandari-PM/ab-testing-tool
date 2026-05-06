import { RemoveOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applyRemove(op: RemoveOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  el.remove();
  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
