import { TargetingRules, UrlMatchType, UrlRule } from "../../../../packages/shared-types/src";

function isMatchType(value: unknown): value is UrlMatchType {
  return value === "wildcard" || value === "regex";
}

function isUrlRule(value: unknown): value is UrlRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rule = value as Partial<UrlRule>;
  return typeof rule.pattern === "string" && isMatchType(rule.matchType) && typeof rule.include === "boolean";
}

function cleanPageUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return pageUrl;
  }
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

function normalizeRule(rule: UrlRule): UrlRule {
  return {
    pattern: rule.pattern.trim() || "*",
    matchType: rule.matchType,
    include: rule.include
  };
}

export function normalizeTargetingRules(targeting?: Partial<TargetingRules> | null): TargetingRules {
  const providedRules = Array.isArray(targeting?.urlRules) ? targeting.urlRules.filter(isUrlRule).map(normalizeRule) : [];
  const legacyPatterns = Array.isArray(targeting?.urlPatterns)
    ? targeting.urlPatterns
        .filter((pattern): pattern is string => typeof pattern === "string")
        .map((pattern) => pattern.trim())
        .filter(Boolean)
        .map((pattern) => ({ pattern, matchType: "wildcard" as const, include: true }))
    : [];

  const urlRules = providedRules.length ? providedRules : legacyPatterns;
  const normalizedRules = urlRules.length
    ? urlRules
    : [{ pattern: "*", matchType: "wildcard" as const, include: true }];

  const urlPatterns = normalizedRules
    .filter((rule) => rule.include && rule.matchType === "wildcard")
    .map((rule) => rule.pattern);

  return {
    urlPatterns: urlPatterns.length ? urlPatterns : ["*"],
    urlRules: normalizedRules
  };
}

export function matchesUrlRule(pageUrl: string, rule: UrlRule): boolean {
  const cleanUrl = cleanPageUrl(pageUrl);

  if (rule.matchType === "regex") {
    try {
      const regex = new RegExp(rule.pattern);
      return regex.test(pageUrl) || regex.test(cleanUrl);
    } catch {
      return false;
    }
  }

  if (rule.pattern === "*") {
    return true;
  }

  const regex = wildcardToRegex(rule.pattern);
  return regex.test(pageUrl) || regex.test(cleanUrl);
}

export function matchesTargetingRules(pageUrl: string, targeting?: Partial<TargetingRules> | null): boolean {
  const normalized = normalizeTargetingRules(targeting);
  const rules = normalized.urlRules ?? [];
  const includeRules = rules.filter((rule) => rule.include);
  const excludeRules = rules.filter((rule) => !rule.include);

  const includeMatch = includeRules.length === 0 || includeRules.some((rule) => matchesUrlRule(pageUrl, rule));
  if (!includeMatch) {
    return false;
  }

  return !excludeRules.some((rule) => matchesUrlRule(pageUrl, rule));
}
