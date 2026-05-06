import { Operation } from "../../shared-types/src";
import { executeOperations } from "../../dom-operations/src";

export interface ReapplyOptions {
  /** Debounce ms after a DOM mutation before re-applying. Default 150. */
  debounceMs?: number;
  /** Extra delay after a history navigation before re-applying. Default 200. */
  navigationDelayMs?: number;
}

type OperationSet = { operations: Operation[] }[];

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isApplying = false;
let origPushState: typeof history.pushState | null = null;
let origReplaceState: typeof history.replaceState | null = null;

function applyAll(sets: OperationSet): void {
  if (isApplying) return;
  isApplying = true;
  for (const { operations } of sets) {
    if (operations.length > 0) executeOperations(operations);
  }
  isApplying = false;
}

export function startReapply(sets: OperationSet, options: ReapplyOptions = {}): void {
  if (typeof document === "undefined") return;

  const debounceMs = options.debounceMs ?? 150;
  const navDelayMs = options.navigationDelayMs ?? 200;

  function schedule(delay = debounceMs): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyAll(sets), delay);
  }

  // MutationObserver — reapply when DOM changes significantly
  observer = new MutationObserver((mutations) => {
    if (isApplying) return;
    const significant = mutations.some(
      (m) => m.type === "childList" && m.addedNodes.length > 0
    );
    if (significant) schedule();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // History intercept — SPA route changes
  origPushState = history.pushState.bind(history);
  origReplaceState = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    origPushState!(...args);
    schedule(navDelayMs);
  };

  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    origReplaceState!(...args);
    schedule(navDelayMs);
  };

  window.addEventListener("popstate", () => schedule(navDelayMs));
}

export function stopReapply(): void {
  observer?.disconnect();
  observer = null;

  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }

  if (origPushState) { history.pushState = origPushState; origPushState = null; }
  if (origReplaceState) { history.replaceState = origReplaceState; origReplaceState = null; }
}
