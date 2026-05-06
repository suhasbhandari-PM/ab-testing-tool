import {
  Experiment,
  ExperimentEvent,
  ExperimentResultsDetail,
  ExperimentResultsListItem,
  ExperimentResultsListResponse,
  Goal,
  GoalResultSummary,
  Variant,
  VariantGoalResult,
  VariantResultSummary
} from "../../../../packages/shared-types/src";
import { store } from "../store/store";

type UserSet = Set<string>;

interface VariantAccumulator {
  exposures: UserSet;
  conversions: UserSet;
  goalConversions: Map<string, UserSet>;
}

function round(value: number, decimals = 4): number {
  const base = 10 ** decimals;
  return Math.round(value * base) / base;
}

function asRate(conversions: number, exposures: number): number {
  if (exposures <= 0) return 0;
  return round(conversions / exposures);
}

function pickControlVariant(variants: Variant[]): Variant | undefined {
  return variants.find((variant) => variant.isControl) ?? variants[0];
}

function intersectCount(left: UserSet, right: UserSet): number {
  let count = 0;
  for (const user of left) {
    if (right.has(user)) count += 1;
  }
  return count;
}

function getGoalName(goals: Goal[], goalId: string): string {
  return goals.find((goal) => goal.id === goalId)?.name ?? goalId;
}

function buildVariantAccumulator(variants: Variant[]): Map<string, VariantAccumulator> {
  const map = new Map<string, VariantAccumulator>();
  for (const variant of variants) {
    map.set(variant.id, {
      exposures: new Set<string>(),
      conversions: new Set<string>(),
      goalConversions: new Map<string, UserSet>()
    });
  }
  return map;
}

function aggregateExperiment(exp: Experiment, events: readonly ExperimentEvent[]): ExperimentResultsDetail {
  const now = new Date().toISOString();
  const variantAcc = buildVariantAccumulator(exp.variants);
  let lastEventAt: string | null = null;

  for (const event of events) {
    if (event.experimentId !== exp.id) continue;
    const acc = variantAcc.get(event.variantId);
    if (!acc) continue;

    if (!lastEventAt || event.timestamp > lastEventAt) {
      lastEventAt = event.timestamp;
    }

    if (event.eventType === "exposure") {
      acc.exposures.add(event.userKey);
      continue;
    }

    acc.conversions.add(event.userKey);
    const goalSet = acc.goalConversions.get(event.goalId) ?? new Set<string>();
    goalSet.add(event.userKey);
    acc.goalConversions.set(event.goalId, goalSet);
  }

  const control = pickControlVariant(exp.variants);
  const controlAcc = control ? variantAcc.get(control.id) : undefined;
  const controlConversions = controlAcc ? intersectCount(controlAcc.conversions, controlAcc.exposures) : 0;
  const controlRate = controlAcc ? asRate(controlConversions, controlAcc.exposures.size) : 0;

  const variantRows: VariantResultSummary[] = exp.variants.map((variant) => {
    const acc = variantAcc.get(variant.id)!;
    const exposures = acc.exposures.size;
    const conversions = intersectCount(acc.conversions, acc.exposures);
    const conversionRate = asRate(conversions, exposures);

    let upliftVsControl: number | null = null;
    if (control && variant.id !== control.id && controlRate > 0) {
      upliftVsControl = round(((conversionRate - controlRate) / controlRate) * 100, 2);
    }

    const goalResults: VariantGoalResult[] = exp.goals.map((goal) => {
      const goalUsers = acc.goalConversions.get(goal.id) ?? new Set<string>();
      const goalConversions = intersectCount(goalUsers, acc.exposures);
      return {
        goalId: goal.id,
        goalName: goal.name,
        conversions: goalConversions,
        conversionRate: asRate(goalConversions, exposures)
      };
    });

    return {
      variantId: variant.id,
      variantName: variant.name,
      isControl: control ? variant.id === control.id : false,
      exposures,
      conversions,
      conversionRate,
      upliftVsControl,
      goalResults,
      screenshots: variant.previewScreenshots
    };
  });

  const exposureUsers = new Set<string>();
  const conversionUsers = new Set<string>();
  for (const row of variantRows) {
    const acc = variantAcc.get(row.variantId)!;
    for (const user of acc.exposures) {
      exposureUsers.add(user);
      if (acc.conversions.has(user)) {
        conversionUsers.add(user);
      }
    }
  }

  const goals: GoalResultSummary[] = exp.goals.map((goal) => ({
    goalId: goal.id,
    goalName: goal.name,
    conversions: variantRows.reduce((sum, variantRow) => {
      const row = variantRow.goalResults.find((g) => g.goalId === goal.id);
      return sum + (row?.conversions ?? 0);
    }, 0),
    variants: variantRows.map((variantRow) => {
      const row = variantRow.goalResults.find((g) => g.goalId === goal.id);
      return {
        variantId: variantRow.variantId,
        variantName: variantRow.variantName,
        conversions: row?.conversions ?? 0
      };
    })
  }));

  return {
    experimentId: exp.id,
    name: exp.name,
    status: exp.status,
    projectId: exp.projectId,
    targeting: exp.targeting,
    generatedAt: now,
    controlVariantId: control?.id ?? null,
    totals: {
      exposures: exposureUsers.size,
      conversions: conversionUsers.size,
      conversionRate: asRate(conversionUsers.size, exposureUsers.size)
    },
    variants: variantRows,
    goals,
    caveats: [
      "Conversion rates are unique-user based and may not be statistically significant at low sample sizes.",
      "Screenshots show page appearance at publish time."
    ],
    lastEventAt
  };
}

function toListItem(detail: ExperimentResultsDetail, experiment: Experiment): ExperimentResultsListItem {
  const bestVariant = detail.variants
    .filter((variant) => !variant.isControl)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  return {
    experimentId: detail.experimentId,
    name: detail.name,
    status: detail.status,
    projectId: detail.projectId,
    updatedAt: experiment.updatedAt,
    totals: detail.totals,
    variantCount: detail.variants.length,
    hasData: detail.totals.exposures > 0,
    controlVariantId: detail.controlVariantId,
    bestVariantId: bestVariant?.variantId ?? null,
    bestVariantName: bestVariant?.variantName ?? null,
    previewScreenshots: bestVariant?.screenshots
  };
}

export async function resultsListRoute(): Promise<{ statusCode: number; body: unknown }> {
  const [experiments, events] = await Promise.all([
    store.getAllExperiments(),
    store.getEvents()
  ]);

  const details = experiments.map((experiment) => aggregateExperiment(experiment, events));
  const items = details
    .map((detail) => {
      const experiment = experiments.find((exp) => exp.id === detail.experimentId)!;
      return toListItem(detail, experiment);
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const response: ExperimentResultsListResponse = {
    generatedAt: new Date().toISOString(),
    items
  };
  return { statusCode: 200, body: response };
}

export async function resultsDetailRoute(experimentId: string): Promise<{ statusCode: number; body: unknown }> {
  const [experiment, events] = await Promise.all([
    store.getExperiment(experimentId),
    store.getEvents()
  ]);

  if (!experiment) {
    return { statusCode: 404, body: { error: "Experiment not found" } };
  }

  const detail = aggregateExperiment(experiment, events);
  return { statusCode: 200, body: detail };
}
