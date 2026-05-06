import { EventIngestPayload, ExposureEvent, ConversionEvent } from "../../shared-types/src";
import { RuntimeApiClient } from "./apiClient";

const exposureMemory = new Set<string>();

function exposureStorageKey(exposureKey: string): string {
  return `ab_exposed:${exposureKey}`;
}

function buildExposureKey(input: {
  projectId: string;
  experimentId: string;
  variantId: string;
  pageUrl: string;
}): string {
  return `${input.projectId}|${input.experimentId}|${input.variantId}|${input.pageUrl}`;
}

function hasExposure(key: string): boolean {
  try {
    if (globalThis.sessionStorage?.getItem(exposureStorageKey(key)) === "1") {
      return true;
    }
  } catch {
    // ignore and fall back to in-memory set
  }

  return exposureMemory.has(key);
}

function markExposure(key: string): void {
  exposureMemory.add(key);

  try {
    globalThis.sessionStorage?.setItem(exposureStorageKey(key), "1");
  } catch {
    // ignore; in-memory guard still prevents duplicates in current runtime
  }
}

export interface TrackExposureInput {
  projectId: string;
  experimentId: string;
  variantId: string;
  userKey: string;
  pageUrl: string;
}

export async function trackExposureOnce(
  client: RuntimeApiClient,
  input: TrackExposureInput
): Promise<boolean> {
  const key = buildExposureKey(input);
  if (hasExposure(key)) {
    return false;
  }

  const event: ExposureEvent = {
    eventType: "exposure",
    projectId: input.projectId,
    experimentId: input.experimentId,
    variantId: input.variantId,
    userKey: input.userKey,
    pageUrl: input.pageUrl,
    timestamp: new Date().toISOString()
  };

  const payload: EventIngestPayload = {
    events: [event]
  };

  await client.ingestEvents(payload);
  markExposure(key);
  return true;
}

export interface TrackConversionInput {
  projectId: string;
  experimentId: string;
  variantId: string;
  userKey: string;
  pageUrl: string;
  goalId: string;
  value?: number;
}

export async function trackConversion(client: RuntimeApiClient, input: TrackConversionInput): Promise<void> {
  const event: ConversionEvent = {
    eventType: "conversion",
    projectId: input.projectId,
    experimentId: input.experimentId,
    variantId: input.variantId,
    userKey: input.userKey,
    pageUrl: input.pageUrl,
    goalId: input.goalId,
    value: input.value,
    timestamp: new Date().toISOString()
  };

  const payload: EventIngestPayload = {
    events: [event]
  };

  await client.ingestEvents(payload);
}
