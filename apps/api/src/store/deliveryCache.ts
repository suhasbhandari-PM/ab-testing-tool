/**
 * deliveryCache.ts — short-lived in-process cache for delivery responses.
 *
 * The delivery route is called on every page load by every visitor.
 * Caching it for 30 s cuts SQLite reads dramatically under traffic spikes
 * while keeping experiment changes visible within one cache period.
 *
 * The cache is keyed by `${projectId}:${cleanPageUrl}` and entries expire
 * after TTL_MS.  Entries are also evicted synchronously whenever an
 * experiment is created, updated, or deleted.
 */

import { Experiment } from "../../../../packages/shared-types/src";

const TTL_MS = 30_000;

interface CacheEntry {
  experiments: Experiment[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(projectId: string, pageUrl: string): string {
  return `${projectId}:${pageUrl}`;
}

export function getDeliveryCache(
  projectId: string,
  pageUrl: string
): Experiment[] | null {
  const entry = cache.get(cacheKey(projectId, pageUrl));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(projectId, pageUrl));
    return null;
  }
  return entry.experiments;
}

export function setDeliveryCache(
  projectId: string,
  pageUrl: string,
  experiments: Experiment[]
): void {
  cache.set(cacheKey(projectId, pageUrl), {
    experiments,
    expiresAt: Date.now() + TTL_MS
  });
}

/** Call after any create / update / delete so stale variants are never served. */
export function invalidateDeliveryCache(): void {
  cache.clear();
}
