/**
 * pgStore.ts - Postgres-backed store for production deployments.
 *
 * Drop-in replacement for sqliteStore. Activated automatically when the
 * DATABASE_URL environment variable is set (Railway / Render provide this).
 *
 * Schema is created on first connect via migrate().
 * All write methods are safe for multiple concurrent Node processes
 * (e.g. PM2 cluster mode) because Postgres handles locking.
 *
 * Usage in server.ts:
 *   import { store } from "./store/store"; // picks pg or sqlite automatically
 */

import { Pool, PoolClient } from "pg";
import { Experiment, ExperimentEvent } from "../../../../packages/shared-types/src";
import { matchesTargetingRules } from "./urlTargeting";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "pgStore imported but DATABASE_URL is not set. " +
    "Use sqliteStore for local development."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

pool.on("error", (err) => {
  console.error("[pgStore] unexpected pool error", err);
});

async function migrate(): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS experiments (
        id   TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id         BIGSERIAL PRIMARY KEY,
        data       JSONB    NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS events_created_at ON events (created_at);
    `);
    console.log("[pgStore] schema ready");
  } finally {
    client.release();
  }
}

// Run migration at module load time; server waits for this before handling requests.
export const ready: Promise<void> = migrate().catch((err) => {
  console.error("[pgStore] migration failed - exiting:", err);
  process.exit(1);
});

class PgStore {
  async getAllExperiments(): Promise<Experiment[]> {
    const { rows } = await pool.query<{ data: Experiment }>(
      "SELECT data FROM experiments ORDER BY data->>'createdAt'"
    );
    return rows.map((r) => r.data);
  }

  async getExperiment(id: string): Promise<Experiment | undefined> {
    const { rows } = await pool.query<{ data: Experiment }>(
      "SELECT data FROM experiments WHERE id = $1",
      [id]
    );
    return rows[0]?.data;
  }

  async saveExperiment(exp: Experiment): Promise<void> {
    await pool.query(
      `INSERT INTO experiments (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [exp.id, JSON.stringify(exp)]
    );
  }

  async deleteExperiment(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      "DELETE FROM experiments WHERE id = $1",
      [id]
    );
    return (rowCount ?? 0) > 0;
  }

  async getActiveExperiments(projectId: string, pageUrl: string): Promise<Experiment[]> {
    const { rows } = await pool.query<{ data: Experiment }>(
      `SELECT data FROM experiments
       WHERE data->>'projectId' = $1
         AND data->>'status' = 'active'`,
      [projectId]
    );

    return rows
      .map((r) => r.data)
      .filter((exp) => matchesTargetingRules(pageUrl, exp.targeting));
  }

  async appendEvents(events: ExperimentEvent[]): Promise<{ accepted: number; rejected: number }> {
    if (events.length === 0) {
      return { accepted: 0, rejected: 0 };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const ev of events) {
        await client.query("INSERT INTO events (data) VALUES ($1)", [JSON.stringify(ev)]);
      }
      await client.query("COMMIT");
      return { accepted: events.length, rejected: 0 };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getEvents(): Promise<readonly ExperimentEvent[]> {
    const { rows } = await pool.query<{ data: ExperimentEvent }>(
      "SELECT data FROM events ORDER BY id"
    );
    return rows.map((r) => r.data);
  }
}

export const pgStore = new PgStore();
