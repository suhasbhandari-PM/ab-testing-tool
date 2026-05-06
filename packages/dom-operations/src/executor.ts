import { Operation } from "../../shared-types/src";
import { applyMoveBefore, applyMoveAfter, applyRemove, applyReplaceHtml, applySetStyle, applySetText, applyInsertHtml, applyModifyClass, applyInjectCss, applyToggleVisibility, applySetAttribute } from "./handlers";
import { ExecutionResult, ExecutorOptions, OperationResult } from "./types";

export function executeOperations(operations: Operation[], options?: ExecutorOptions): ExecutionResult {
  if (typeof document === "undefined") {
    return { applied: 0, skipped: 0, failed: 0, results: [] };
  }

  const logger = options?.logger ?? ((msg: string, detail?: unknown) => console.warn(`[ab-test] ${msg}`, detail));
  const results: OperationResult[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    let result: OperationResult;

    try {
      switch (op.type) {
        case "set_text":
          result = applySetText(op, i);
          break;
        case "set_style":
          result = applySetStyle(op, i);
          break;
        case "replace_html":
          result = applyReplaceHtml(op, i);
          break;
        case "move_before":
          result = applyMoveBefore(op, i);
          break;
        case "move_after":
          result = applyMoveAfter(op, i);
          break;
        case "remove":
          result = applyRemove(op, i);
          break;
        case "insert_html":
          result = applyInsertHtml(op, i);
          break;
        case "modify_class":
          result = applyModifyClass(op, i);
          break;
        case "inject_css":
          result = applyInjectCss(op, i);
          break;
        case "toggle_visibility":
          result = applyToggleVisibility(op, i);
          break;
        case "set_attribute":
          result = applySetAttribute(op, i);
          break;
        default: {
          const exhaustiveCheck: never = op;
          result = { status: "failed", operationIndex: i, type: (exhaustiveCheck as Operation).type, selector: "", reason: "Unknown operation type" };
        }
      }
    } catch (err) {
      const selector = "selector" in op ? op.selector : "sourceSelector" in op ? op.sourceSelector : "";
      result = { status: "failed", operationIndex: i, type: op.type, selector, reason: err instanceof Error ? err.message : String(err) };
      logger(`Operation ${i} (${op.type}) threw an error`, err);
    }

    if (result.status === "failed") {
      logger(`Operation ${i} (${op.type}) failed: ${(result as { reason: string }).reason}`, op);
      failed++;
    } else if (result.status === "skipped") {
      skipped++;
    } else {
      applied++;
    }

    results.push(result);
  }

  return { applied, skipped, failed, results };
}
