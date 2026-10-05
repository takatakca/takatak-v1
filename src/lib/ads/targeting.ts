import type {
  AdsTargetingContext,
  AdsTargetingRules,
} from "./types";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("en-CA");
}

function normalizedList(values: string[] | undefined): string[] {
  return (values ?? []).map(normalize).filter(Boolean);
}

function exactRuleMatches(
  rules: string[] | undefined,
  value: string | null | undefined,
): boolean {
  const normalizedRules = normalizedList(rules);
  if (normalizedRules.length === 0) return true;
  const candidate = normalize(value);
  return Boolean(candidate && normalizedRules.includes(candidate));
}

function postalRuleMatches(
  rules: string[] | undefined,
  value: string | null | undefined,
): boolean {
  const normalizedRules = normalizedList(rules).map((item) =>
    item.replace(/\s+/g, ""),
  );
  if (normalizedRules.length === 0) return true;
  const candidate = normalize(value).replace(/\s+/g, "");
  return Boolean(
    candidate &&
      normalizedRules.some((prefix) => candidate.startsWith(prefix)),
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
  return items.length ? items : undefined;
}

export function parseAdsTargetingRules(
  value: unknown,
): AdsTargetingRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  return {
    countries: stringArray(raw.countries),
    regions: stringArray(raw.regions),
    cities: stringArray(raw.cities),
    postalPrefixes: stringArray(raw.postalPrefixes),
    categories: stringArray(raw.categories),
    locales: stringArray(raw.locales),
    devices: stringArray(raw.devices),
  };
}

export function matchesAdsTargeting(
  rules: AdsTargetingRules,
  context: AdsTargetingContext,
): boolean {
  return (
    exactRuleMatches(rules.countries, context.country) &&
    exactRuleMatches(rules.regions, context.region) &&
    exactRuleMatches(rules.cities, context.city) &&
    postalRuleMatches(rules.postalPrefixes, context.postalPrefix) &&
    exactRuleMatches(rules.categories, context.category) &&
    exactRuleMatches(rules.locales, context.locale) &&
    exactRuleMatches(rules.devices, context.device)
  );
}

export function adsTargetingSpecificity(
  rules: AdsTargetingRules,
): number {
  return [
    rules.countries,
    rules.regions,
    rules.cities,
    rules.postalPrefixes,
    rules.categories,
    rules.locales,
    rules.devices,
  ].reduce((score, values) => score + (values?.length ? 1 : 0), 0);
}
