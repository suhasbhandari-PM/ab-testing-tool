declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function ensureGtag(measurementId: string): void {
  if (typeof window === "undefined") return;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function (...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag("js", new Date());

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  window.gtag("config", measurementId, { send_page_view: false });
}

export function trackExposureGA4(
  measurementId: string,
  experimentId: string,
  experimentName: string,
  variantId: string,
  variantName: string
): void {
  if (typeof window === "undefined") return;
  ensureGtag(measurementId);
  window.gtag("event", "ab_exposure", {
    experiment_id: experimentId,
    experiment_name: experimentName,
    variant_id: variantId,
    variant_name: variantName
  });
}

export function trackConversionGA4(
  measurementId: string,
  experimentId: string,
  variantId: string,
  goalId: string,
  value?: number
): void {
  if (typeof window === "undefined") return;
  ensureGtag(measurementId);
  const params: Record<string, unknown> = {
    experiment_id: experimentId,
    variant_id: variantId,
    goal_id: goalId
  };
  if (value !== undefined) params.value = value;
  window.gtag("event", "ab_conversion", params);
}
