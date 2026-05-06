export const SUPPORTED_OPERATION_TYPES = [
  "set_text",
  "set_style",
  "replace_html",
  "move_before",
  "move_after",
  "remove",
  "insert_html",
  "modify_class",
  "inject_css",
  "toggle_visibility",
  "set_attribute"
] as const;

export type OperationType = (typeof SUPPORTED_OPERATION_TYPES)[number];
export type ReplacePosition = "inner" | "outer";
export type InsertPosition = "before" | "after" | "prepend" | "append";
export type ModifyClassAction = "add" | "remove" | "toggle";
export type ViewportMode = "desktop" | "mobile";

export interface SetTextOperation {
  type: "set_text";
  selector: string;
  text: string;
}

export interface SetStyleOperation {
  type: "set_style";
  selector: string;
  styleMap: Record<string, string>;
}

export interface ReplaceHtmlOperation {
  type: "replace_html";
  selector: string;
  html: string;
  position: ReplacePosition;
}

export interface MoveBeforeOperation {
  type: "move_before";
  sourceSelector: string;
  targetSelector: string;
}

export interface MoveAfterOperation {
  type: "move_after";
  sourceSelector: string;
  targetSelector: string;
}

export interface RemoveOperation {
  type: "remove";
  selector: string;
}

export interface InsertHtmlOperation {
  type: "insert_html";
  selector: string;
  html: string;
  position: InsertPosition;
}

export interface ModifyClassOperation {
  type: "modify_class";
  selector: string;
  action: ModifyClassAction;
  classes: string;
}

export interface InjectCssOperation {
  type: "inject_css";
  css: string;
  id: string;
}

export interface ToggleVisibilityOperation {
  type: "toggle_visibility";
  selector: string;
  action: "show" | "hide";
}

export interface SetAttributeOperation {
  type: "set_attribute";
  selector: string;
  attribute: string;
  value: string;
}

export type Operation =
  | SetTextOperation
  | SetStyleOperation
  | ReplaceHtmlOperation
  | MoveBeforeOperation
  | MoveAfterOperation
  | RemoveOperation
  | InsertHtmlOperation
  | ModifyClassOperation
  | InjectCssOperation
  | ToggleVisibilityOperation
  | SetAttributeOperation;

export type ExperimentStatus = "draft" | "active" | "paused" | "archived";
export type GoalType = "custom" | "click" | "pageview";
export type UrlMatchType = "wildcard" | "regex";

export interface UrlRule {
  pattern: string;
  matchType: UrlMatchType;
  include: boolean;
}

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  /** CSS selector to listen for clicks on (click goals only) */
  selector?: string;
  /** URL substring or wildcard pattern to match (pageview goals only) */
  urlPattern?: string;
}

export interface VariantScreenshot {
  viewport: ViewportMode;
  url: string;
  dataUrl?: string;
  capturedAt: string;
  width: number;
  height: number;
}

export interface VariantScreenshotSet {
  desktop?: VariantScreenshot;
  mobile?: VariantScreenshot;
}

export interface Variant {
  id: string;
  name: string;
  weight: number;
  operations: Operation[];
  isControl?: boolean;
  previewScreenshots?: VariantScreenshotSet;
}

export interface TargetingRules {
  urlPatterns: string[];
  urlRules?: UrlRule[];
}

export interface Experiment {
  id: string;
  projectId: string;
  name: string;
  status: ExperimentStatus;
  trafficAllocation: number;
  targeting: TargetingRules;
  variants: Variant[];
  goals: Goal[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryResponse {
  projectId: string;
  pageUrl: string;
  generatedAt: string;
  experiments: Experiment[];
}

export type ExperimentEventType = "exposure" | "conversion";

export interface BaseExperimentEvent {
  eventType: ExperimentEventType;
  projectId: string;
  experimentId: string;
  variantId: string;
  userKey: string;
  pageUrl: string;
  timestamp: string;
}

export interface ExposureEvent extends BaseExperimentEvent {
  eventType: "exposure";
}

export interface ConversionEvent extends BaseExperimentEvent {
  eventType: "conversion";
  goalId: string;
  value?: number;
}

export type ExperimentEvent = ExposureEvent | ConversionEvent;

export interface EventIngestPayload {
  events: ExperimentEvent[];
}

export interface EventIngestResponse {
  accepted: number;
  rejected: number;
}

export interface ResultsTotals {
  exposures: number;
  conversions: number;
  conversionRate: number;
}

export interface VariantGoalResult {
  goalId: string;
  goalName: string;
  conversions: number;
  conversionRate: number;
}

export interface VariantResultSummary {
  variantId: string;
  variantName: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  conversionRate: number;
  upliftVsControl: number | null;
  goalResults: VariantGoalResult[];
  screenshots?: VariantScreenshotSet;
}

export interface GoalResultSummary {
  goalId: string;
  goalName: string;
  conversions: number;
  variants: Array<{
    variantId: string;
    variantName: string;
    conversions: number;
  }>;
}

export interface ExperimentResultsDetail {
  experimentId: string;
  name: string;
  status: ExperimentStatus;
  projectId: string;
  targeting: TargetingRules;
  generatedAt: string;
  controlVariantId: string | null;
  totals: ResultsTotals;
  variants: VariantResultSummary[];
  goals: GoalResultSummary[];
  caveats: string[];
  lastEventAt: string | null;
}

export interface ExperimentResultsListItem {
  experimentId: string;
  name: string;
  status: ExperimentStatus;
  projectId: string;
  updatedAt: string;
  totals: ResultsTotals;
  variantCount: number;
  hasData: boolean;
  controlVariantId: string | null;
  bestVariantId: string | null;
  bestVariantName: string | null;
  previewScreenshots?: VariantScreenshotSet;
}

export interface ExperimentResultsListResponse {
  generatedAt: string;
  items: ExperimentResultsListItem[];
}

export interface ExperimentSnapshotUploadPayload {
  variantId: string;
  viewport: ViewportMode;
  imageDataUrl: string;
  width: number;
  height: number;
  capturedAt?: string;
}

export interface ExperimentSnapshotUploadResponse {
  variantId: string;
  viewport: ViewportMode;
  snapshot: VariantScreenshot;
}

export function isSupportedOperationType(value: unknown): value is OperationType {
  if (typeof value !== "string") {
    return false;
  }

  return (SUPPORTED_OPERATION_TYPES as readonly string[]).includes(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isOperation(value: unknown): value is Operation {
  if (!isObject(value) || !isSupportedOperationType(value.type)) {
    return false;
  }

  switch (value.type) {
    case "set_text":
      return typeof value.selector === "string" && typeof value.text === "string";
    case "set_style":
      return (
        typeof value.selector === "string" &&
        isObject(value.styleMap) &&
        Object.values(value.styleMap).every((styleValue) => typeof styleValue === "string")
      );
    case "replace_html":
      return (
        typeof value.selector === "string" &&
        typeof value.html === "string" &&
        (value.position === "inner" || value.position === "outer")
      );
    case "move_before":
    case "move_after":
      return typeof value.sourceSelector === "string" && typeof value.targetSelector === "string";
    case "remove":
      return typeof value.selector === "string";
    case "insert_html":
      return (
        typeof value.selector === "string" &&
        typeof value.html === "string" &&
        (value.position === "before" || value.position === "after" ||
         value.position === "prepend" || value.position === "append")
      );
    case "modify_class":
      return (
        typeof value.selector === "string" &&
        (value.action === "add" || value.action === "remove" || value.action === "toggle") &&
        typeof value.classes === "string"
      );
    case "inject_css":
      return typeof value.css === "string" && typeof value.id === "string";
    case "toggle_visibility":
      return typeof value.selector === "string" && (value.action === "show" || value.action === "hide");
    case "set_attribute":
      return (
        typeof value.selector === "string" &&
        typeof value.attribute === "string" &&
        typeof value.value === "string"
      );
    default:
      return false;
  }
}

function isExperimentEvent(value: unknown): value is ExperimentEvent {
  if (!isObject(value)) {
    return false;
  }

  const hasBaseFields =
    typeof value.eventType === "string" &&
    typeof value.projectId === "string" &&
    typeof value.experimentId === "string" &&
    typeof value.variantId === "string" &&
    typeof value.userKey === "string" &&
    typeof value.pageUrl === "string" &&
    typeof value.timestamp === "string";

  if (!hasBaseFields) {
    return false;
  }

  if (value.eventType === "exposure") {
    return true;
  }

  if (value.eventType === "conversion") {
    return typeof value.goalId === "string" && (value.value === undefined || typeof value.value === "number");
  }

  return false;
}

export function isEventIngestPayload(value: unknown): value is EventIngestPayload {
  if (!isObject(value) || !Array.isArray(value.events)) {
    return false;
  }

  return value.events.every((event) => isExperimentEvent(event));
}
