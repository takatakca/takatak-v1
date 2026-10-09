import { parseAdsTargetingRules } from "./targeting";

export const ADS_CAMPAIGN_SCOPES = [
  "single_site",
  "local_network",
  "max_lead_pro",
] as const;

export const ADS_PRICING_MODELS = [
  "cpm",
  "cpc",
  "cpl",
  "fixed",
] as const;

export type CreateAdsCampaignInput = {
  name: string;
  businessBrandId: string | null;
  scope: (typeof ADS_CAMPAIGN_SCOPES)[number];
  objective: string | null;
  pricingModel: (typeof ADS_PRICING_MODELS)[number];
  budgetCents: number;
  dailyBudgetCents: number | null;
  bidCents: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  targeting: ReturnType<typeof parseAdsTargetingRules>;
  placementIds: string[];
  creative: {
    name: string;
    headline: string;
    body: string | null;
    callToAction: string | null;
    destinationUrl: string;
    imageUrl: string | null;
  };
};

function stringValue(
  value: unknown,
  max: number,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function integerValue(
  value: unknown,
): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

export function validateCreateAdsCampaign(
  value: unknown,
):
  | { success: true; data: CreateAdsCampaignInput }
  | {
      success: false;
      message: string;
      fieldErrors: Record<string, string>;
    } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "Campaign details are required.",
      fieldErrors: { campaign: "Campaign details are required." },
    };
  }

  const raw = value as Record<string, unknown>;
  const creativeRaw =
    raw.creative &&
    typeof raw.creative === "object" &&
    !Array.isArray(raw.creative)
      ? (raw.creative as Record<string, unknown>)
      : {};

  const name = stringValue(raw.name, 120);
  const businessBrandId = stringValue(raw.businessBrandId, 80);
  const scope =
    typeof raw.scope === "string" &&
    (ADS_CAMPAIGN_SCOPES as readonly string[]).includes(raw.scope)
      ? (raw.scope as CreateAdsCampaignInput["scope"])
      : null;
  const pricingModel =
    typeof raw.pricingModel === "string" &&
    (ADS_PRICING_MODELS as readonly string[]).includes(raw.pricingModel)
      ? (raw.pricingModel as CreateAdsCampaignInput["pricingModel"])
      : null;
  const budgetCents = integerValue(raw.budgetCents);
  const dailyBudgetCents =
    raw.dailyBudgetCents === null || raw.dailyBudgetCents === undefined
      ? null
      : integerValue(raw.dailyBudgetCents);
  const bidCents =
    raw.bidCents === null || raw.bidCents === undefined
      ? null
      : integerValue(raw.bidCents);
  const startsAt = parseDate(raw.startsAt);
  const endsAt = parseDate(raw.endsAt);
  const placementIds = stringArray(raw.placementIds);

  const creativeName =
    stringValue(creativeRaw.name, 120) ?? "Primary creative";
  const headline = stringValue(creativeRaw.headline, 160);
  const body = stringValue(creativeRaw.body, 1000);
  const callToAction = stringValue(creativeRaw.callToAction, 80);
  const destinationUrl = stringValue(creativeRaw.destinationUrl, 2048);
  const imageUrl = stringValue(creativeRaw.imageUrl, 2048);

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Campaign name is required.";
  if (!scope) fieldErrors.scope = "Choose a valid campaign scope.";
  if (!pricingModel) {
    fieldErrors.pricingModel = "Choose a valid pricing model.";
  }
  if (budgetCents === null || budgetCents <= 0) {
    fieldErrors.budgetCents = "Budget must be a positive amount in cents.";
  }
  if (
    dailyBudgetCents !== null &&
    (dailyBudgetCents <= 0 ||
      (budgetCents !== null && dailyBudgetCents > budgetCents))
  ) {
    fieldErrors.dailyBudgetCents =
      "Daily budget must be positive and cannot exceed total budget.";
  }
  if (bidCents !== null && bidCents < 0) {
    fieldErrors.bidCents = "Bid cannot be negative.";
  }
  if (
    (pricingModel === "cpc" ||
      pricingModel === "cpm" ||
      pricingModel === "cpl") &&
    (bidCents === null || bidCents <= 0)
  ) {
    fieldErrors.bidCents =
      "A positive bid is required for CPC, CPM or CPL pricing.";
  }
  if (
    raw.startsAt !== null &&
    raw.startsAt !== undefined &&
    raw.startsAt !== "" &&
    !startsAt
  ) {
    fieldErrors.startsAt = "Start date is invalid.";
  }
  if (
    raw.endsAt !== null &&
    raw.endsAt !== undefined &&
    raw.endsAt !== "" &&
    !endsAt
  ) {
    fieldErrors.endsAt = "End date is invalid.";
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    fieldErrors.endsAt = "End date must be after start date.";
  }
  if (scope === "single_site" && placementIds.length === 0) {
    fieldErrors.placementIds =
      "TAKATAK ADS Direct requires at least one placement.";
  }
  if (!headline) fieldErrors.headline = "Creative headline is required.";
  if (!destinationUrl || !isHttpUrl(destinationUrl)) {
    fieldErrors.destinationUrl =
      "Creative destination must be a valid HTTP or HTTPS URL.";
  }
  if (imageUrl && !isHttpUrl(imageUrl)) {
    fieldErrors.imageUrl = "Creative image must be a valid HTTP or HTTPS URL.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Review the campaign details.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      name: name!,
      businessBrandId,
      scope: scope!,
      objective: stringValue(raw.objective, 240),
      pricingModel: pricingModel!,
      budgetCents: budgetCents!,
      dailyBudgetCents,
      bidCents,
      startsAt,
      endsAt,
      targeting: parseAdsTargetingRules(raw.targeting),
      placementIds,
      creative: {
        name: creativeName,
        headline: headline!,
        body,
        callToAction,
        destinationUrl: destinationUrl!,
        imageUrl,
      },
    },
  };
}

export function validateAdsCampaignStatus(
  value: unknown,
):
  | {
      success: true;
      data: {
        status: "draft" | "active" | "paused" | "completed" | "canceled";
      };
    }
  | {
      success: false;
      message: string;
      fieldErrors: Record<string, string>;
    } {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const allowed = [
    "draft",
    "active",
    "paused",
    "completed",
    "canceled",
  ] as const;
  const status =
    typeof raw.status === "string" &&
    (allowed as readonly string[]).includes(raw.status)
      ? (raw.status as (typeof allowed)[number])
      : null;

  if (!status) {
    return {
      success: false,
      message: "Choose a valid campaign status.",
      fieldErrors: { status: "Campaign status is invalid." },
    };
  }

  return { success: true, data: { status } };
}
