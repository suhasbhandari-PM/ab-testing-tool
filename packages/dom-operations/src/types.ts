export interface OperationSuccess {
  status: "applied" | "skipped";
  operationIndex: number;
  type: string;
  selector: string;
}

export interface OperationFailure {
  status: "failed";
  operationIndex: number;
  type: string;
  selector: string;
  reason: string;
}

export type OperationResult = OperationSuccess | OperationFailure;

export interface ExecutionResult {
  applied: number;
  skipped: number;
  failed: number;
  results: OperationResult[];
}

export interface ExecutorOptions {
  logger?: (message: string, detail?: unknown) => void;
}
