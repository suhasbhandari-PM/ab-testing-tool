/**
 * store.ts — auto-selects the backing store.
 *
 * - If DATABASE_URL is set  → Postgres (pgStore)
 * - Otherwise              → SQLite  (sqliteStore, default for local dev)
 *
 * Import `store` everywhere instead of importing sqliteStore directly.
 * The eventBuffer also uses this module so it flushes to the right backend.
 */

import { Experiment, ExperimentEvent } from "../../../../packages/shared-types/src";

export interface Store {
  getAllExperiments(): Promise<Experiment[]> | Experiment[];
  getExperiment(id: string): Promise<Experiment | undefined> | Experiment | undefined;
  saveExperiment(exp: Experiment): Promise<void> | void;
  deleteExperiment(id: string): Promise<boolean> | boolean;
  getActiveExperiments(projectId: string, pageUrl: string): Promise<Experiment[]> | Experiment[];
  appendEvents(events: ExperimentEvent[]): Promise<{ accepted: number; rejected: number }> | { accepted: number; rejected: number };
  getEvents(): Promise<readonly ExperimentEvent[]> | readonly ExperimentEvent[];
}

let _store: Store;

if (process.env.DATABASE_URL) {
  // Lazy-require so the pg module (and its connection attempt) is only loaded
  // when DATABASE_URL is actually present.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pgStore } = require("./pgStore") as { pgStore: Store };
  _store = pgStore;
  console.log("[store] using Postgres");
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sqliteStore } = require("./sqliteStore") as { sqliteStore: Store };
  _store = sqliteStore;
  console.log("[store] using SQLite");
}

export const store: Store = _store;
