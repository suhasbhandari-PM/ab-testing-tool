import * as fs from "fs";
import * as path from "path";
import { Experiment, ExperimentEvent } from "../../../../packages/shared-types/src";
import { matchesTargetingRules } from "./urlTargeting";

const STORE_PATH = path.join(__dirname, "experiments.json");

interface StoreData {
  experiments: Experiment[];
}

function readStore(): StoreData {
  if (!fs.existsSync(STORE_PATH)) {
    return { experiments: [] };
  }
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  return JSON.parse(raw) as StoreData;
}

function writeStore(data: StoreData): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

class FileStore {
  private readonly events: ExperimentEvent[] = [];

  getAllExperiments(): Experiment[] {
    return readStore().experiments;
  }

  getExperiment(id: string): Experiment | undefined {
    return readStore().experiments.find((e) => e.id === id);
  }

  saveExperiment(exp: Experiment): void {
    const data = readStore();
    const idx = data.experiments.findIndex((e) => e.id === exp.id);
    if (idx >= 0) {
      data.experiments[idx] = exp;
    } else {
      data.experiments.push(exp);
    }
    writeStore(data);
  }

  deleteExperiment(id: string): boolean {
    const data = readStore();
    const idx = data.experiments.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    data.experiments.splice(idx, 1);
    writeStore(data);
    return true;
  }

  getActiveExperiments(projectId: string, pageUrl: string): Experiment[] {
    return readStore().experiments.filter((exp) => {
      if (exp.projectId !== projectId || exp.status !== "active") return false;
      return matchesTargetingRules(pageUrl, exp.targeting);
    });
  }

  appendEvents(events: ExperimentEvent[]): { accepted: number; rejected: number } {
    this.events.push(...events);
    return { accepted: events.length, rejected: 0 };
  }

  getEvents(): readonly ExperimentEvent[] {
    return this.events;
  }
}

export const fileStore = new FileStore();
