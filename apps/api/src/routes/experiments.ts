import { Experiment } from "../../../../packages/shared-types/src";
import { invalidateDeliveryCache } from "../store/deliveryCache";
import { store } from "../store/store";
import { normalizeTargetingRules } from "../store/urlTargeting";

function isPartialExperiment(value: unknown): value is Partial<Experiment> {
  return typeof value === "object" && value !== null;
}

export async function experimentsListRoute(): Promise<{ statusCode: number; body: unknown }> {
  const experiments = await store.getAllExperiments();
  return { statusCode: 200, body: experiments };
}

export async function experimentsGetRoute(id: string): Promise<{ statusCode: number; body: unknown }> {
  const exp = await store.getExperiment(id);
  if (!exp) return { statusCode: 404, body: { error: "Experiment not found" } };
  return { statusCode: 200, body: exp };
}

export async function experimentsCreateRoute(payload: unknown): Promise<{ statusCode: number; body: unknown }> {
  if (!isPartialExperiment(payload)) {
    return { statusCode: 400, body: { error: "Invalid payload" } };
  }

  const now = new Date().toISOString();
  const exp: Experiment = {
    id: `exp_${Date.now()}`,
    projectId: (payload as Record<string, string>).projectId ?? "my-site",
    name: (payload as Record<string, string>).name ?? "Untitled experiment",
    status: "draft",
    trafficAllocation: 100,
    targeting: normalizeTargetingRules({
      urlPatterns: [(payload as Record<string, string>).targetUrl ?? "*"]
    }),
    variants: [
      { id: "control", name: "Control", weight: 50, isControl: true, operations: [] },
      { id: `var_${Date.now()}`, name: "Variant A", weight: 50, operations: [] }
    ],
    goals: [],
    createdAt: now,
    updatedAt: now
  };

  await store.saveExperiment(exp);
  invalidateDeliveryCache();
  return { statusCode: 201, body: exp };
}

export async function experimentsUpdateRoute(id: string, payload: unknown): Promise<{ statusCode: number; body: unknown }> {
  const existing = await store.getExperiment(id);
  if (!existing) return { statusCode: 404, body: { error: "Experiment not found" } };
  if (!isPartialExperiment(payload)) return { statusCode: 400, body: { error: "Invalid payload" } };

  const updated: Experiment = {
    ...existing,
    ...(payload as Partial<Experiment>),
    id: existing.id,
    updatedAt: new Date().toISOString()
  };

  updated.targeting = normalizeTargetingRules(updated.targeting);

  await store.saveExperiment(updated);
  invalidateDeliveryCache();
  return { statusCode: 200, body: updated };
}

export async function experimentsDeleteRoute(id: string): Promise<{ statusCode: number; body: unknown }> {
  const deleted = await store.deleteExperiment(id);
  if (!deleted) return { statusCode: 404, body: { error: "Experiment not found" } };
  invalidateDeliveryCache();
  return { statusCode: 204, body: {} };
}
