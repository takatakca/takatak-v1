export const CONTENT_RESOURCE_TYPES = [
  "news","post","photo","image","gallery","schedule","arena","team","page","faq","sponsor","other",
] as const;
export type ContentResourceType = (typeof CONTENT_RESOURCE_TYPES)[number];

export const CONTRIBUTION_ACTIONS = [
  "create","update","replace_media","correct_fact","remove",
] as const;
export type ContributionAction = (typeof CONTRIBUTION_ACTIONS)[number];

export type ContributorTier = "guest" | "registered" | "member";
export type ContributionPriority = "standard" | "member_priority";
export type ContributionDecision = "approve" | "reject" | "changes_requested";

export type ContributionInput = {
  idempotencyKey: string;
  resourceType: ContentResourceType;
  resourceKey: string;
  action: ContributionAction;
  targetUrl?: string;
  originalVersion?: number;
  originalSnapshot?: unknown;
  proposedPatch: Record<string, unknown>;
  reason?: string;
  evidenceUrls?: string[];
  attachmentUrls?: string[];
  contributorAuthUserId?: string;
};

export type ContentRegistryInput = {
  resourceType: ContentResourceType;
  resourceKey: string;
  title?: string;
  canonicalUrl?: string;
  sourceKind: string;
  sourceUrl?: string;
  snapshot: Record<string, unknown>;
  editableFields?: string[];
  version?: number;
};
