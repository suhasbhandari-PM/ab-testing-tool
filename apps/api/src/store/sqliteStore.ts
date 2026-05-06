import Database from "better-sqlite3";
import * as path from "path";
import { Experiment, ExperimentEvent } from "../../../../packages/shared-types/src";
import { matchesTargetingRules } from "./urlTargeting";

const DB_PATH = path.join(__dirname, "ab-testing.db");

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS experiments (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    data       TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

const stmtGetAll   = db.prepare<[], { data: string }>("SELECT data FROM experiments");
const stmtGetById  = db.prepare<[string], { data: string }>("SELECT data FROM experiments WHERE id = ?");
const stmtUpsert   = db.prepare<[string, string]>("INSERT OR REPLACE INTO experiments (id, data) VALUES (?, ?)");
const stmtDelete   = db.prepare<[string]>("DELETE FROM experiments WHERE id = ?");
const stmtInsertEv = db.prepare<[string]>("INSERT INTO events (data) VALUES (?)");

class SqliteStore {
  getAllExperiments(): Experiment[] {
    return stmtGetAll.all().map((r) => JSON.parse(r.data) as Experiment);
  }

  getExperiment(id: string): Experiment | undefined {
    const row = stmtGetById.get(id);
    return row ? (JSON.parse(row.data) as Experiment) : undefined;
  }

  saveExperiment(exp: Experiment): void {
    stmtUpsert.run(exp.id, JSON.stringify(exp));
  }

  deleteExperiment(id: string): boolean {
    const result = stmtDelete.run(id);
    return result.changes > 0;
  }

  getActiveExperiments(projectId: string, pageUrl: string): Experiment[] {
    return this.getAllExperiments().filter((exp) => {
      if (exp.projectId !== projectId || exp.status !== "active") return false;
      return matchesTargetingRules(pageUrl, exp.targeting);
    });
  }

  appendEvents(events: ExperimentEvent[]): { accepted: number; rejected: number } {
    const insert = db.transaction((evs: ExperimentEvent[]) => {
      for (const ev of evs) stmtInsertEv.run(JSON.stringify(ev));
    });
    insert(events);
    return { accepted: events.length, rejected: 0 };
  }

  getEvents(): readonly ExperimentEvent[] {
    const rows = db.prepare<[], { data: string }>("SELECT data FROM events ORDER BY id").all();
    return rows.map((r) => JSON.parse(r.data) as ExperimentEvent);
  }
}

export const sqliteStore = new SqliteStore();
