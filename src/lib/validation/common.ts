export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      message: string;
      fieldErrors: FieldErrors;
    };

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function normalizeOptionalString(
  value: unknown,
  maximumLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maximumLength);
}

export function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
  options: {
    minimumLength?: number;
    maximumLength: number;
  },
): string {
  const value = source[key];

  if (typeof value !== "string") {
    fieldErrors[key] = `${label} is required.`;
    return "";
  }

  const normalized = value.trim();
  const minimumLength = options.minimumLength ?? 1;

  if (normalized.length < minimumLength) {
    fieldErrors[key] =
      `${label} must contain at least ${minimumLength} characters.`;

    return normalized;
  }

  if (normalized.length > options.maximumLength) {
    fieldErrors[key] =
      `${label} must contain no more than ${options.maximumLength} characters.`;
  }

  return normalized;
}

export function readOptionalString(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
  maximumLength: number,
): string | null {
  const value = source[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    fieldErrors[key] = `${label} must be text.`;
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maximumLength) {
    fieldErrors[key] =
      `${label} must contain no more than ${maximumLength} characters.`;
  }

  return normalized;
}

export function readEmail(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
  required: boolean,
): string | null {
  const value = source[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      fieldErrors[key] = `${label} is required.`;
    }

    return null;
  }

  if (typeof value !== "string") {
    fieldErrors[key] = `${label} is invalid.`;
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    fieldErrors[key] = `${label} is invalid.`;
  }

  return normalized;
}

export function readHttpUrl(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
): string | null {
  const value = readOptionalString(
    source,
    key,
    label,
    fieldErrors,
    2048,
  );

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      fieldErrors[key] =
        `${label} must use http or https.`;
    }
  } catch {
    fieldErrors[key] = `${label} is invalid.`;
  }

  return value;
}

export function isValidTimeZone(
  value: string,
): boolean {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format();

    return true;
  } catch {
    return false;
  }
}

export function readTimeZone(
  source: Record<string, unknown>,
  key: string,
  fieldErrors: FieldErrors,
): string {
  const timezone = readRequiredString(
    source,
    key,
    "Timezone",
    fieldErrors,
    {
      maximumLength: 100,
    },
  );

  if (timezone && !isValidTimeZone(timezone)) {
    fieldErrors[key] =
      "Timezone must be a valid IANA timezone, such as America/Toronto.";
  }

  return timezone;
}

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fieldErrors: FieldErrors,
): boolean {
  const value = source[key];

  if (typeof value !== "boolean") {
    fieldErrors[key] =
      "This value must be true or false.";

    return false;
  }

  return value;
}

export function readNullableNumber(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
  minimum: number,
  maximum: number,
): number | null {
  const rawValue = source[key];

  if (
    rawValue === undefined ||
    rawValue === null ||
    rawValue === ""
  ) {
    return null;
  }

  const value =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? Number(rawValue.trim())
        : Number.NaN;

  if (!Number.isFinite(value)) {
    fieldErrors[key] =
      `${label} must be a number.`;

    return null;
  }

  if (value < minimum || value > maximum) {
    fieldErrors[key] =
      `${label} must be between ${minimum} and ${maximum}.`;
  }

  return value;
}

export function readEnumValue<
  T extends string,
>(
  source: Record<string, unknown>,
  key: string,
  label: string,
  fieldErrors: FieldErrors,
  allowedValues: readonly T[],
): T {
  const value = source[key];

  if (
    typeof value !== "string" ||
    !allowedValues.includes(value as T)
  ) {
    fieldErrors[key] = `${label} is invalid.`;
    return allowedValues[0];
  }

  return value as T;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function invalidRequest<T>(
  fieldErrors: FieldErrors,
  message =
    "Correct the highlighted fields and try again.",
): ValidationResult<T> {
  return {
    success: false,
    message,
    fieldErrors,
  };
}