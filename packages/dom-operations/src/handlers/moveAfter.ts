import { MoveAfterOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

export function applyMoveAfter(op: MoveAfterOperation, index: number): OperationResult {
  const source = document.querySelector(op.sourceSelector);
  if (!source) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.sourceSelector, reason: "Source element not found" };
  }

  const target = document.querySelector(op.targetSelector);
  if (!target) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.targetSelector, reason: "Target element not found" };
  }

  if (target.nextElementSibling === source) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.sourceSelector };
  }

  if (!target.parentNode) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.targetSelector, reason: "Target element has no parent" };
  }

  target.parentNode.insertBefore(source, target.nextSibling);
  return { status: "applied", operationIndex: index, type: op.type, selector: op.sourceSelector };
}
