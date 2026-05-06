import { Experiment, Variant } from "../../shared-types/src";

/**
 * Parse QA overrides from the URL.
 * Format: ?ab_qa=experimentId:variantId (repeat for multiple experiments)
 * Example: ?ab_qa=exp_123:variant_a&ab_qa=exp_456:control
 */
export function parseQAOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();

  try {
    if (typeof window === "undefined") return overrides;
    const params = new URLSearchParams(window.location.search);
    for (const value of params.getAll("ab_qa")) {
      const colonIdx = value.indexOf(":");
      if (colonIdx < 1) continue;
      const experimentId = value.slice(0, colonIdx).trim();
      const variantId = value.slice(colonIdx + 1).trim();
      if (experimentId && variantId) overrides.set(experimentId, variantId);
    }
  } catch {
    // non-browser env or malformed URL — return empty
  }

  return overrides;
}

/** Returns the forced variant for an experiment if a QA override is active. */
export function getQAVariant(experiment: Experiment, overrides: Map<string, string>): Variant | null {
  const forcedVariantId = overrides.get(experiment.id);
  if (!forcedVariantId) return null;
  return experiment.variants.find((v) => v.id === forcedVariantId) ?? null;
}

export function isQAActive(): boolean {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("ab_qa");
  } catch {
    return false;
  }
}
