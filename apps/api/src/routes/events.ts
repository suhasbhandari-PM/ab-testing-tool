import {
  EventIngestPayload,
  EventIngestResponse,
  isEventIngestPayload
} from "../../../../packages/shared-types/src";
import { pushEvents } from "../store/eventBuffer";

export function eventsRoute(payload: unknown): { statusCode: number; body: unknown } {
  if (!isEventIngestPayload(payload)) {
    return {
      statusCode: 400,
      body: {
        error: "Invalid payload"
      }
    };
  }

  const typedPayload = payload as EventIngestPayload;
  pushEvents(typedPayload.events);
  const result: EventIngestResponse = { accepted: typedPayload.events.length, rejected: 0 };

  return {
    statusCode: 202,
    body: result
  };
}
