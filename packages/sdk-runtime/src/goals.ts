import { Experiment, Variant } from "../../shared-types/src";

type ConversionFn = (experimentId: string, variantId: string, goalId: string) => Promise<void>;

const firedPageviews = new Set<string>();

function matchesUrl(urlPattern: string): boolean {
  const current = typeof window !== "undefined" ? window.location.href : "";
  if (urlPattern === "*") return true;
  if (current.includes(urlPattern)) return true;
  try {
    const escaped = urlPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(current);
  } catch {
    return false;
  }
}

export function wireGoals(
  assignments: { experiment: Experiment; variant: Variant }[],
  trackConversion: ConversionFn
): () => void {
  if (typeof document === "undefined") return () => {};

  const cleanups: (() => void)[] = [];

  for (const { experiment, variant } of assignments) {
    for (const goal of experiment.goals) {
      if (goal.type === "click" && goal.selector) {
        const selector = goal.selector;
        const handler = (e: Event) => {
          const target = e.target as Element;
          try {
            if (target.matches(selector) || target.closest(selector)) {
              trackConversion(experiment.id, variant.id, goal.id);
            }
          } catch {
            // invalid selector — ignore
          }
        };
        document.addEventListener("click", handler, true);
        cleanups.push(() => document.removeEventListener("click", handler, true));
      }

      if (goal.type === "pageview" && goal.urlPattern) {
        const key = `${experiment.id}:${variant.id}:${goal.id}`;

        const check = () => {
          if (firedPageviews.has(key)) return;
          if (matchesUrl(goal.urlPattern!)) {
            firedPageviews.add(key);
            trackConversion(experiment.id, variant.id, goal.id);
          }
        };

        // Check immediately (user may already be on the target page)
        check();

        // Re-check on SPA navigation
        const onNav = () => setTimeout(check, 150);
        window.addEventListener("popstate", onNav);

        // Wrap history methods if not already done by reapply.ts
        const origPush = history.pushState.bind(history);
        const navHandler = (...args: Parameters<typeof history.pushState>) => {
          origPush(...args);
          setTimeout(check, 150);
        };
        // Only attach if reapply hasn't already wrapped it
        if ((history.pushState as { __abWrapped?: boolean }).__abWrapped !== true) {
          (navHandler as { __abWrapped?: boolean }).__abWrapped = true;
        }
        window.addEventListener("popstate", onNav);
        cleanups.push(() => window.removeEventListener("popstate", onNav));
      }
    }
  }

  return () => cleanups.forEach((fn) => fn());
}
