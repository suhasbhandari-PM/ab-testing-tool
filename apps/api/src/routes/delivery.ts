import { DeliveryResponse } from "../../../../packages/shared-types/src";
import { getDeliveryCache, setDeliveryCache } from "../store/deliveryCache";
import { store } from "../store/store";

export async function deliveryRoute(input: {
  projectId?: string;
  pageUrl?: string;
}): Promise<{ statusCode: number; body: unknown }> {
  const projectId = input.projectId?.trim();
  const pageUrl = input.pageUrl?.trim();

  if (!projectId || !pageUrl) {
    return {
      statusCode: 400,
      body: {
        error: "projectId and pageUrl are required"
      }
    };
  }

  // Strip query string so cache key is stable regardless of tracking params
  let cleanUrl = pageUrl;
  try { cleanUrl = new URL(pageUrl).origin + new URL(pageUrl).pathname; } catch { /* use as-is */ }

  let experiments = getDeliveryCache(projectId, cleanUrl);
  if (experiments === null) {
    experiments = await store.getActiveExperiments(projectId, pageUrl);
    setDeliveryCache(projectId, cleanUrl, experiments);
  }

  const response: DeliveryResponse = {
    projectId,
    pageUrl,
    generatedAt: new Date().toISOString(),
    experiments
  };

  return {
    statusCode: 200,
    body: response
  };
}
