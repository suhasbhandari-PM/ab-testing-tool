import { Experiment, Variant } from "../../shared-types/src";

function hashString(input: string): number {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return hash >>> 0;
}

function hashToUnitInterval(input: string): number {
  return hashString(input) / 0xffffffff;
}

export function isInExperimentTraffic(experiment: Experiment, userKey: string): boolean {
  const normalizedAllocation = Math.max(0, Math.min(100, experiment.trafficAllocation));

  if (normalizedAllocation <= 0) {
    return false;
  }

  if (normalizedAllocation >= 100) {
    return true;
  }

  const bucket = hashToUnitInterval(`${experiment.id}:traffic:${userKey}`) * 100;
  return bucket < normalizedAllocation;
}

export function assignVariant(experiment: Experiment, userKey: string): Variant | null {
  if (experiment.status !== "active" || !isInExperimentTraffic(experiment, userKey)) {
    return null;
  }

  const candidates = experiment.variants.filter((variant) => variant.weight > 0);
  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, variant) => sum + variant.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const roll = hashToUnitInterval(`${experiment.id}:variant:${userKey}`) * totalWeight;
  let cursor = 0;

  for (const variant of candidates) {
    cursor += variant.weight;
    if (roll < cursor) {
      return variant;
    }
  }

  return candidates[candidates.length - 1] ?? null;
}
