export type HockeyTravelProfileInput = {
  originLabel: string | null;
  originAddress: string;
};

function cleanText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

export function validateHockeyTravelProfileInput(value: unknown):
  | { success: true; data: HockeyTravelProfileInput }
  | { success: false; message: string; fieldErrors: Record<string, string> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "Enter the departure address you explicitly want TAKATAK to use.",
      fieldErrors: { originAddress: "A departure address is required." },
    };
  }

  const input = value as Record<string, unknown>;
  const originAddress = cleanText(input.originAddress, 320);
  const originLabel = cleanText(input.originLabel, 80);
  const consent = input.consent === true;
  const fieldErrors: Record<string, string> = {};

  if (!originAddress || originAddress.length < 5) {
    fieldErrors.originAddress =
      "Enter a complete departure address for route calculations.";
  }
  if (!consent) {
    fieldErrors.consent =
      "Explicit consent is required before saving a departure address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Review the smart-departure settings.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      originLabel,
      originAddress: originAddress!,
    },
  };
}
