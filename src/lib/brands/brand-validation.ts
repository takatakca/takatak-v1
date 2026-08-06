import {
    invalidRequest,
    isRecord,
    readEnumValue,
    readHttpUrl,
    readOptionalString,
    readRequiredString,
    readTimeZone,
    type ValidationResult,
  } from "@/lib/validation/common";
  
  export const BRAND_STATUSES = [
    "draft",
    "active",
    "paused",
    "archived",
  ] as const;
  
  export type BrandStatusValue =
    (typeof BRAND_STATUSES)[number];
  
  export interface BrandInput {
    name: string;
    legalName: string | null;
    category: string | null;
    website: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string;
    timezone: string;
    status: BrandStatusValue;
  }
  
  function validatePhone(
    phone: string | null,
    fieldErrors: Record<string, string>,
  ): void {
    if (!phone) {
      return;
    }
  
    const phonePattern = /^[0-9+\-().\s#xext]+$/i;
  
    if (!phonePattern.test(phone)) {
      fieldErrors.phone =
        "Phone can contain numbers, spaces, parentheses, plus signs, hyphens, and extensions only.";
    }
  }
  
  export function validateBrandInput(
    value: unknown,
  ): ValidationResult<BrandInput> {
    if (!isRecord(value)) {
      return invalidRequest<BrandInput>(
        {},
        "The brand request is invalid.",
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
  
    const legalName = readOptionalString(
      value,
      "legalName",
      "Legal name",
      fieldErrors,
      180,
    );
  
    const category = readOptionalString(
      value,
      "category",
      "Category",
      fieldErrors,
      120,
    );
  
    const website = readHttpUrl(
      value,
      "website",
      "Website",
      fieldErrors,
    );
  
    const phone = readOptionalString(
      value,
      "phone",
      "Phone",
      fieldErrors,
      40,
    );
  
    const addressLine1 = readOptionalString(
      value,
      "addressLine1",
      "Address line 1",
      fieldErrors,
      180,
    );
  
    const addressLine2 = readOptionalString(
      value,
      "addressLine2",
      "Address line 2",
      fieldErrors,
      180,
    );
  
    const city = readOptionalString(
      value,
      "city",
      "City",
      fieldErrors,
      100,
    );
  
    const region = readOptionalString(
      value,
      "region",
      "Province or region",
      fieldErrors,
      100,
    );
  
    const postalCode = readOptionalString(
      value,
      "postalCode",
      "Postal code",
      fieldErrors,
      30,
    );
  
    const country = readRequiredString(
      value,
      "country",
      "Country",
      fieldErrors,
      {
        maximumLength: 100,
      },
    );
  
    const timezone = readTimeZone(
      value,
      "timezone",
      fieldErrors,
    );
  
    const status = readEnumValue(
      value,
      "status",
      "Brand status",
      fieldErrors,
      BRAND_STATUSES,
    );
  
    validatePhone(phone, fieldErrors);
  
    if (Object.keys(fieldErrors).length > 0) {
      return invalidRequest<BrandInput>(
        fieldErrors,
      );
    }
  
    return {
      success: true,
      data: {
        name,
        legalName,
        category,
        website,
        phone,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        timezone,
        status,
      },
    };
  }