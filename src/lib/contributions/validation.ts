import {
  CONTENT_RESOURCE_TYPES,
  CONTRIBUTION_ACTIONS,
  type ContentRegistryInput,
  type ContributionInput,
} from "./types";

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : undefined;
}

function stringArray(value: unknown, maxItems = 8, maxLen = 1200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function parseContributionInput(value: unknown): ContributionInput | null {
  const row = object(value);
  if (!row) return null;

  const resourceType = text(row.resourceType, 40);
  const action = text(row.action, 40);
  const idempotencyKey = text(row.idempotencyKey, 120);
  const resourceKey = text(row.resourceKey, 180);
  const proposedPatch = object(row.proposedPatch);

  if (
    !resourceType ||
    !CONTENT_RESOURCE_TYPES.includes(resourceType as (typeof CONTENT_RESOURCE_TYPES)[number]) ||
    !action ||
    !CONTRIBUTION_ACTIONS.includes(action as (typeof CONTRIBUTION_ACTIONS)[number]) ||
    !idempotencyKey ||
    !resourceKey ||
    !proposedPatch
  ) {
    return null;
  }

  const originalVersion =
    typeof row.originalVersion === "number" &&
    Number.isInteger(row.originalVersion) &&
    row.originalVersion >= 1
      ? row.originalVersion
      : undefined;

  return {
    idempotencyKey,
    resourceType: resourceType as ContributionInput["resourceType"],
    resourceKey,
    action: action as ContributionInput["action"],
    proposedPatch,
    ...(text(row.targetUrl, 1200) ? { targetUrl: text(row.targetUrl, 1200)! } : {}),
    ...(originalVersion ? { originalVersion } : {}),
    ...(object(row.originalSnapshot) ? { originalSnapshot: object(row.originalSnapshot)! } : {}),
    ...(text(row.reason, 2000) ? { reason: text(row.reason, 2000)! } : {}),
    evidenceUrls: stringArray(row.evidenceUrls),
    attachmentUrls: stringArray(row.attachmentUrls),
    ...(text(row.contributorAuthUserId, 80) ? { contributorAuthUserId: text(row.contributorAuthUserId, 80)! } : {}),
  };
}

export function parseContentRegistryItems(value: unknown): ContentRegistryInput[] | null {
  const root = object(value);
  if (!root || !Array.isArray(root.items)) return null;

  const parsed: ContentRegistryInput[] = [];
  for (const raw of root.items.slice(0, 100)) {
    const row = object(raw);
    if (!row) return null;
    const resourceType = text(row.resourceType, 40);
    const resourceKey = text(row.resourceKey, 180);
    const sourceKind = text(row.sourceKind, 80);
    const snapshot = object(row.snapshot);
    if (
      !resourceType ||
      !CONTENT_RESOURCE_TYPES.includes(resourceType as (typeof CONTENT_RESOURCE_TYPES)[number]) ||
      !resourceKey ||
      !sourceKind ||
      !snapshot
    ) {
      return null;
    }

    const version =
      typeof row.version === "number" && Number.isInteger(row.version) && row.version >= 1
        ? row.version
        : undefined;

    parsed.push({
      resourceType: resourceType as ContentRegistryInput["resourceType"],
      resourceKey,
      sourceKind,
      snapshot,
      ...(text(row.title, 300) ? { title: text(row.title, 300)! } : {}),
      ...(text(row.canonicalUrl, 1200) ? { canonicalUrl: text(row.canonicalUrl, 1200)! } : {}),
      ...(text(row.sourceUrl, 1200) ? { sourceUrl: text(row.sourceUrl, 1200)! } : {}),
      editableFields: stringArray(row.editableFields, 50, 100),
      ...(version ? { version } : {}),
    });
  }

  return parsed;
}
