import {
  CONTENT_RESOURCE_TYPES,
  CONTRIBUTION_ACTIONS,
  type ContributionInput,
} from "./types";
import { requiresOfficialSourceVerification } from "./policy";

export type ContributionScreening = {
  status: "passed" | "flagged";
  flags: string[];
  provider: "takatak_rules_v1";
  humanReviewRequired: true;
};

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

export function screenContribution(
  input: ContributionInput,
): ContributionScreening {
  const flags: string[] = [];
  const text = jsonText(input.proposedPatch).toLowerCase();

  if (!CONTENT_RESOURCE_TYPES.includes(input.resourceType)) flags.push("invalid_resource_type");
  if (!CONTRIBUTION_ACTIONS.includes(input.action)) flags.push("invalid_action");
  if (!input.resourceKey.trim()) flags.push("missing_resource_key");
  if (!input.idempotencyKey.trim()) flags.push("missing_idempotency_key");
  if (!input.proposedPatch || Array.isArray(input.proposedPatch)) flags.push("invalid_patch");

  if (input.targetUrl && !isHttps(input.targetUrl)) flags.push("unsafe_target_url");
  for (const url of [...(input.evidenceUrls ?? []), ...(input.attachmentUrls ?? [])]) {
    if (!isHttps(url)) flags.push("unsafe_external_url");
  }

  if (requiresOfficialSourceVerification(input.resourceType) && !(input.evidenceUrls?.length)) {
    flags.push("official_source_evidence_required");
  }

  if (
    (input.resourceType === "photo" || input.resourceType === "image") &&
    input.action === "replace_media" &&
    !(input.attachmentUrls?.length)
  ) {
    flags.push("replacement_media_required");
  }

  const sensitiveKeys = [
    "password","secret","token","auth_token","medical","birthdate","dateofbirth",
    "homeaddress","roster","playeremail","parentemail",
  ];
  if (sensitiveKeys.some((key) => text.includes(`"${key}"`))) {
    flags.push("possible_sensitive_information");
  }

  if (text.length > 60_000) flags.push("patch_too_large");

  return {
    status: flags.length ? "flagged" : "passed",
    flags: Array.from(new Set(flags)),
    provider: "takatak_rules_v1",
    humanReviewRequired: true,
  };
}
