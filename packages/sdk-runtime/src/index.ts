import { DeliveryResponse, Experiment, Variant } from "../../shared-types/src";
import { executeOperations, ExecutionResult } from "../../dom-operations/src";
import { RuntimeApiClient } from "./apiClient";
import { assignVariant } from "./assignment";
import { ensureGtag, trackExposureGA4, trackConversionGA4 } from "./ga4";
import { getOrCreateUserKey } from "./identity";
import { wireGoals } from "./goals";
import { parseQAOverrides, getQAVariant, isQAActive } from "./qaMode";
import { startReapply, stopReapply, ReapplyOptions } from "./reapply";
import { trackConversion, trackExposureOnce } from "./tracking";

export interface RuntimeInitOptions {
  apiBaseUrl: string;
  projectId: string;
  pageUrl?: string;
  userKeyStorageKey?: string;
  autoTrackExposure?: boolean;
  applyOperations?: boolean;
  /** GA4 Measurement ID (e.g. "G-XXXXXXXXXX"). When set, fires ab_exposure and
   *  ab_conversion events to GA4 alongside the internal /v1/events endpoint. */
  ga4MeasurementId?: string;
  /** Automatically re-apply operations after SPA route changes. Default: true. */
  spaReapply?: boolean;
  /** Options for SPA reapply timing. */
  reapplyOptions?: ReapplyOptions;
}

export interface AssignedExperiment {
  experiment: Experiment;
  variant: Variant;
}

export interface RuntimeInitResult {
  userKey: string;
  delivery: DeliveryResponse;
  assignments: AssignedExperiment[];
  client: RuntimeApiClient;
  operationResults: ExecutionResult[];
  /** true if QA mode is active (?ab_qa=... in URL) */
  isQAMode: boolean;
  /** Pre-bound conversion tracker. Fires both internal events and GA4 (if configured). */
  trackConversion: (experimentId: string, variantId: string, goalId: string, value?: number) => Promise<void>;
  /** Stop SPA reapply observer and history intercepts. */
  stopReapply: () => void;
  /** Remove auto-wired goal listeners. */
  stopGoals: () => void;
}

function resolvePageUrl(override?: string): string {
  if (override) return override;
  if (typeof globalThis.location !== "undefined" && typeof globalThis.location.href === "string") {
    return globalThis.location.href;
  }
  return "";
}

export async function initializeRuntime(options: RuntimeInitOptions): Promise<RuntimeInitResult> {
  const pageUrl = resolvePageUrl(options.pageUrl);
  const userKey = getOrCreateUserKey(options.userKeyStorageKey);
  const qaMode = isQAActive();
  const qaOverrides = qaMode ? parseQAOverrides() : new Map<string, string>();

  const client = new RuntimeApiClient({
    baseUrl: options.apiBaseUrl,
    projectId: options.projectId
  });

  if (options.ga4MeasurementId) {
    ensureGtag(options.ga4MeasurementId);
  }

  const delivery = await client.fetchDelivery(pageUrl);
  const assignments: AssignedExperiment[] = [];

  for (const experiment of delivery.experiments) {
    // QA override takes priority over normal assignment
    const variant = qaMode
      ? (getQAVariant(experiment, qaOverrides) ?? assignVariant(experiment, userKey))
      : assignVariant(experiment, userKey);

    if (!variant) continue;

    assignments.push({ experiment, variant });

    if (!qaMode && options.autoTrackExposure !== false) {
      await trackExposureOnce(client, {
        projectId: options.projectId,
        experimentId: experiment.id,
        variantId: variant.id,
        userKey,
        pageUrl
      });
    }

    if (options.ga4MeasurementId && !qaMode) {
      trackExposureGA4(
        options.ga4MeasurementId,
        experiment.id,
        experiment.name,
        variant.id,
        variant.name
      );
    }
  }

  const operationResults: ExecutionResult[] = [];

  if (options.applyOperations !== false) {
    for (const { variant } of assignments) {
      if (variant.isControl || variant.operations.length === 0) {
        operationResults.push({ applied: 0, skipped: 0, failed: 0, results: [] });
        continue;
      }
      operationResults.push(executeOperations(variant.operations));
    }
  }

  // SPA reapply
  if (options.spaReapply !== false && options.applyOperations !== false) {
    const operationSets = assignments
      .filter(({ variant }) => !variant.isControl)
      .map(({ variant }) => ({ operations: variant.operations }));

    if (operationSets.length > 0) {
      startReapply(operationSets, options.reapplyOptions);
    }
  }

  const boundTrackConversion = async (
    experimentId: string,
    variantId: string,
    goalId: string,
    value?: number
  ): Promise<void> => {
    if (!qaMode) {
      await trackConversion(client, {
        projectId: options.projectId,
        experimentId,
        variantId,
        userKey,
        pageUrl,
        goalId,
        value
      });
    }
    if (options.ga4MeasurementId && !qaMode) {
      trackConversionGA4(options.ga4MeasurementId, experimentId, variantId, goalId, value);
    }
  };

  // Auto-wire goal listeners
  const stopGoals = wireGoals(assignments, boundTrackConversion);

  return {
    userKey,
    delivery,
    assignments,
    client,
    operationResults,
    isQAMode: qaMode,
    trackConversion: boundTrackConversion,
    stopReapply,
    stopGoals
  };
}

export { RuntimeApiClient } from "./apiClient";
export { assignVariant, isInExperimentTraffic } from "./assignment";
export { getOrCreateUserKey } from "./identity";
export { trackConversion, trackExposureOnce } from "./tracking";
export { ensureGtag, trackExposureGA4, trackConversionGA4 } from "./ga4";
export { parseQAOverrides, getQAVariant, isQAActive } from "./qaMode";
export { startReapply, stopReapply } from "./reapply";
export { executeOperations } from "../../dom-operations/src";
