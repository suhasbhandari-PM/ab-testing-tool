/**
 * eventBuffer.ts — in-memory batching layer for event writes.
 *
 * Instead of hitting SQLite (or Postgres) on every SDK ping, events are
 * held in memory for up to FLUSH_INTERVAL_MS, then written in a single
 * batch.  On failure the batch is re-queued so no events are lost.
 * SIGTERM / SIGINT handlers flush synchronously before the process exits.
 */

import { ExperimentEvent } from "../../../../packages/shared-types/src";
import { store } from "./store";

const FLUSH_INTERVAL_MS = 3_000;

let buffer: ExperimentEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flush(): void {
  if (buffer.length === 0) return;

  const batch = buffer;
  buffer = [];

  try {
    store.appendEvents(batch);
  } catch (err) {
    // Re-queue so events aren't lost — prepend so ordering is preserved
    buffer = [...batch, ...buffer];
    console.error("[eventBuffer] flush failed, re-queued", batch.length, "events:", err);
  }
}

/** Start the background flush timer (idempotent). */
export function startEventBuffer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
  if (flushTimer.unref) flushTimer.unref(); // don't keep process alive just for the timer
}

/** Accept events from the API route — they are buffered and written later. */
export function pushEvents(events: ExperimentEvent[]): void {
  buffer.push(...events);
}

/** Flush immediately and stop the timer. Used in graceful-shutdown handlers. */
export function shutdownEventBuffer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush();
}

// Graceful shutdown: flush before the process exits
function onShutdown(signal: string): void {
  console.log(`[eventBuffer] received ${signal} — flushing ${buffer.length} buffered events`);
  shutdownEventBuffer();
  process.exit(0);
}

process.on("SIGTERM", () => onShutdown("SIGTERM"));
process.on("SIGINT",  () => onShutdown("SIGINT"));

// Start automatically when this module is first imported
startEventBuffer();
