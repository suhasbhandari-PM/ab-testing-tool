import * as fs from "fs";
import * as path from "path";
import { ServerResponse } from "http";
import {
  ExperimentSnapshotUploadPayload,
  ExperimentSnapshotUploadResponse,
  VariantScreenshot
} from "../../../../packages/shared-types/src";
import { invalidateDeliveryCache } from "../store/deliveryCache";
import { store } from "../store/store";

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR?.trim() || path.join(process.cwd(), "apps", "api", "src", "store", "snapshots");

function ensureSnapshotDir(): void {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

function isUploadPayload(value: unknown): value is ExperimentSnapshotUploadPayload {
  if (typeof value !== "object" || value === null) return false;
  const typed = value as Partial<ExperimentSnapshotUploadPayload>;
  return (
    typeof typed.variantId === "string" &&
    (typed.viewport === "desktop" || typed.viewport === "mobile") &&
    typeof typed.imageDataUrl === "string" &&
    typeof typed.width === "number" &&
    typeof typed.height === "number"
  );
}

function decodeImageDataUrl(imageDataUrl: string): { ext: string; mime: string; buffer: Buffer } | null {
  const match = imageDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const imageType = match[1].toLowerCase();
  const ext = imageType === "png" ? "png" : "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const buffer = Buffer.from(match[2], "base64");
  return { ext, mime, buffer };
}

function safeFileName(fileName: string): string | null {
  if (!fileName || fileName.includes("..")) return null;
  const normalized = path.basename(fileName);
  if (normalized !== fileName) return null;
  return normalized;
}

export async function experimentSnapshotUploadRoute(
  experimentId: string,
  payload: unknown
): Promise<{ statusCode: number; body: unknown }> {
  if (!isUploadPayload(payload)) {
    return { statusCode: 400, body: { error: "Invalid payload" } };
  }

  const experiment = await store.getExperiment(experimentId);
  if (!experiment) {
    return { statusCode: 404, body: { error: "Experiment not found" } };
  }

  const variant = experiment.variants.find((item) => item.id === payload.variantId);
  if (!variant) {
    return { statusCode: 400, body: { error: "Variant not found in experiment" } };
  }

  const decoded = decodeImageDataUrl(payload.imageDataUrl);
  if (!decoded) {
    return { statusCode: 400, body: { error: "imageDataUrl must be a PNG/JPEG data URL" } };
  }

  ensureSnapshotDir();
  const fileName = `${experiment.id}_${variant.id}_${payload.viewport}.${decoded.ext}`;
  const absPath = path.join(SNAPSHOT_DIR, fileName);
  fs.writeFileSync(absPath, decoded.buffer);

  const capturedAt = payload.capturedAt ?? new Date().toISOString();
  const snapshot: VariantScreenshot = {
    viewport: payload.viewport,
    url: `/v1/snapshots/${encodeURIComponent(fileName)}`,
    dataUrl: payload.imageDataUrl,
    capturedAt,
    width: payload.width,
    height: payload.height
  };

  variant.previewScreenshots = {
    ...(variant.previewScreenshots ?? {}),
    [payload.viewport]: snapshot
  };
  experiment.updatedAt = new Date().toISOString();

  await store.saveExperiment(experiment);
  invalidateDeliveryCache();

  const response: ExperimentSnapshotUploadResponse = {
    variantId: variant.id,
    viewport: payload.viewport,
    snapshot
  };
  return { statusCode: 201, body: response };
}

export function snapshotFileRoute(fileName: string, res: ServerResponse): boolean {
  const safeName = safeFileName(fileName);
  if (!safeName) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid snapshot filename" }));
    return true;
  }

  const absPath = path.join(SNAPSHOT_DIR, safeName);
  if (!fs.existsSync(absPath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Snapshot not found" }));
    return true;
  }

  const ext = path.extname(absPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  res.statusCode = 200;
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  fs.createReadStream(absPath).pipe(res);
  return true;
}
