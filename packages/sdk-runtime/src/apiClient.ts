import {
  DeliveryResponse,
  EventIngestPayload,
  EventIngestResponse
} from "../../shared-types/src";

export interface RuntimeApiClientOptions {
  baseUrl: string;
  projectId: string;
  timeoutMs?: number;
}

export class RuntimeApiClient {
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly timeoutMs: number;

  constructor(options: RuntimeApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.projectId = options.projectId;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async fetchDelivery(pageUrl: string): Promise<DeliveryResponse> {
    const url = new URL("/v1/delivery", this.baseUrl);
    url.searchParams.set("projectId", this.projectId);
    url.searchParams.set("pageUrl", pageUrl);

    return this.fetchJson<DeliveryResponse>(url.toString(), {
      method: "GET"
    });
  }

  async ingestEvents(payload: EventIngestPayload): Promise<EventIngestResponse> {
    const url = new URL("/v1/events", this.baseUrl);

    return this.fetchJson<EventIngestResponse>(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
