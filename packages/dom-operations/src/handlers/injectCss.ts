import { InjectCssOperation } from "../../../shared-types/src";
import { OperationResult } from "../types";

const CSS_ATTR = "data-ab-css-id";

export function applyInjectCss(op: InjectCssOperation, index: number): OperationResult {
  const existing = document.querySelector(`style[${CSS_ATTR}="${CSS.escape(op.id)}"]`);
  if (existing) {
    return { status: "skipped", operationIndex: index, type: op.type, selector: "" };
  }

  const style = document.createElement("style");
  style.setAttribute(CSS_ATTR, op.id);
  style.textContent = op.css;
  document.head.appendChild(style);

  return { status: "applied", operationIndex: index, type: op.type, selector: "" };
}
