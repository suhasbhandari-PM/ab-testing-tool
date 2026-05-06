import { InsertHtmlOperation } from "../../../shared-types/src";
import { hashContent, isAlreadyApplied, markApplied } from "../idempotency";
import { OperationResult } from "../types";

const POSITION_MAP: Record<InsertHtmlOperation["position"], "beforebegin" | "afterend" | "afterbegin" | "beforeend"> = {
  before:  "beforebegin",
  after:   "afterend",
  prepend: "afterbegin",
  append:  "beforeend"
};

export function applyInsertHtml(op: InsertHtmlOperation, index: number): OperationResult {
  const el = document.querySelector(op.selector);
  if (!el) {
    return { status: "failed", operationIndex: index, type: op.type, selector: op.selector, reason: "Element not found" };
  }

  const contentHash = hashContent(op.html + op.position);
  const attrKey = `insert-${contentHash}`;

  if (isAlreadyApplied(el, attrKey)) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: op.selector };
  }

  el.insertAdjacentHTML(POSITION_MAP[op.position], op.html);
  markApplied(el, attrKey);

  return { status: "applied", operationIndex: index, type: op.type, selector: op.selector };
}
