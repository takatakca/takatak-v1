import {
  invalidRequest,
  isRecord,
  isUuid,
  readBoolean,
  readRequiredString,
  type ValidationResult,
} from "@/lib/validation/common";

export const ENGAGEMENT_RATIOS = [100, 1000] as const;

export type EngagementRatioValue = (typeof ENGAGEMENT_RATIOS)[number];

export interface BrandSettingsInput {
  name: string;
  imageSocialAccountId: string | null;
  engagementRatio: EngagementRatioValue;
  applyEngagementToAllBrands: boolean;
}

export function validateBrandSettingsInput(
  value: unknown,
): ValidationResult<BrandSettingsInput> {
  if (!isRecord(value)) {
    return invalidRequest<BrandSettingsInput>(
      {},
      "The brand settings request is invalid.",
    );
  }

  const fieldErrors: Record<string, string> = {};

  const name = readRequiredString(
    value,
    "name",
    "Brand name",
    fieldErrors,
    {
      minimumLength: 2,
      maximumLength: 120,
    },
  );

  const engagementRaw = value.engagementRatio;
  const engagementNormalized =
    typeof engagementRaw === "number"
      ? String(engagementRaw)
      : typeof engagementRaw === "string"
        ? engagementRaw.trim()
        : "";

  if (engagementNormalized !== "100" && engagementNormalized !== "1000") {
    fieldErrors.engagementRatio =
      "Select Ratio x 100 or Ratio x 1000.";
  }

  const imageValue = value.imageSocialAccountId;

  let imageSocialAccountId: string | null = null;

  if (imageValue === null || imageValue === "") {
    imageSocialAccountId = null;
  } else if (typeof imageValue === "string" && isUuid(imageValue)) {
    imageSocialAccountId = imageValue;
  } else {
    fieldErrors.imageSocialAccountId =
      "Choose an image from a connected account in this brand.";
  }

  const applyEngagementToAllBrands = readBoolean(
    value,
    "applyEngagementToAllBrands",
    fieldErrors,
  );

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest<BrandSettingsInput>(fieldErrors);
  }

  return {
    success: true,
    data: {
      name,
      imageSocialAccountId,
      engagementRatio: Number(engagementNormalized) as EngagementRatioValue,
      applyEngagementToAllBrands,
    },
  };
}
