import {
  invalidRequest,
  isRecord,
  type ValidationResult,
} from "@/lib/validation/common";

export const AI_INSTRUCTION_PLATFORMS = [
  "bluesky",
  "facebook",
  "instagram",
  "google_business",
  "pinterest",
  "tiktok",
  "youtube",
  "threads",
  "x",
  "linkedin",
] as const;

export type AiInstructionPlatform =
  (typeof AI_INSTRUCTION_PLATFORMS)[number];

export function toAiInstructionPlatform(
  value: string,
): AiInstructionPlatform | null {
  const platform = value.trim().toLowerCase();

  if (platform === "tiktok_business") {
    return "tiktok";
  }

  if (AI_INSTRUCTION_PLATFORMS.includes(platform as AiInstructionPlatform)) {
    return platform as AiInstructionPlatform;
  }

  return null;
}

export interface BrandAiInstructionsInput {
  general: string;
  platforms: Record<string, string>;
}

const GENERAL_MAX = 8000;
const PLATFORM_MAX = 4000;

function readBoundedText(
  value: unknown,
  field: string,
  maximum: number,
  fieldErrors: Record<string, string>,
): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    fieldErrors[field] = "Instructions must be text.";
    return "";
  }

  if (value.length > maximum) {
    fieldErrors[field] =
      `Instructions must contain no more than ${maximum} characters.`;
  }

  return value;
}

export function parseStoredInstructions(value: unknown): BrandAiInstructionsInput {
  if (!isRecord(value)) {
    return { general: "", platforms: {} };
  }

  const general =
    typeof value.general === "string" ? value.general : "";
  const platforms: Record<string, string> = {};

  if (isRecord(value.platforms)) {
    for (const [key, text] of Object.entries(value.platforms)) {
      if (
        AI_INSTRUCTION_PLATFORMS.includes(key as AiInstructionPlatform) &&
        typeof text === "string"
      ) {
        platforms[key] = text;
      }
    }
  }

  return { general, platforms };
}

export function validateBrandAiInstructionsInput(
  value: unknown,
): ValidationResult<BrandAiInstructionsInput> {
  if (!isRecord(value)) {
    return invalidRequest<BrandAiInstructionsInput>(
      {},
      "The AI instructions request is invalid.",
    );
  }

  const fieldErrors: Record<string, string> = {};
  const general = readBoundedText(
    value.general,
    "general",
    GENERAL_MAX,
    fieldErrors,
  );

  const platforms: Record<string, string> = {};
  const rawPlatforms = value.platforms;

  if (rawPlatforms !== undefined && rawPlatforms !== null) {
    if (!isRecord(rawPlatforms)) {
      fieldErrors.platforms = "Platform instructions are invalid.";
    } else {
      for (const [key, text] of Object.entries(rawPlatforms)) {
        if (
          !AI_INSTRUCTION_PLATFORMS.includes(key as AiInstructionPlatform)
        ) {
          fieldErrors.platforms = "One of the platforms is not supported.";
          continue;
        }

        platforms[key] = readBoundedText(
          text,
          `platforms.${key}`,
          PLATFORM_MAX,
          fieldErrors,
        );
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return invalidRequest<BrandAiInstructionsInput>(fieldErrors);
  }

  return {
    success: true,
    data: { general, platforms },
  };
}

export function composeGeneralInstructions(options: {
  storedGeneral: string;
  tone: string | null;
  audience: string | null;
  keywords: string[];
  bannedPhrases: string[];
  notes: string | null;
  sampleCaption: string | null;
}): string {
  if (options.storedGeneral.trim()) {
    return options.storedGeneral;
  }

  const parts: string[] = [];

  if (options.tone?.trim()) {
    parts.push(`Tone: ${options.tone.trim()}`);
  }
  if (options.audience?.trim()) {
    parts.push(`Audience: ${options.audience.trim()}`);
  }
  if (options.keywords.length > 0) {
    parts.push(`Keywords: ${options.keywords.join(", ")}`);
  }
  if (options.bannedPhrases.length > 0) {
    parts.push(`Avoid: ${options.bannedPhrases.join(", ")}`);
  }
  if (options.notes?.trim()) {
    parts.push(options.notes.trim());
  }
  if (options.sampleCaption?.trim()) {
    parts.push(`Sample caption: ${options.sampleCaption.trim()}`);
  }

  return parts.join("\n\n");
}
