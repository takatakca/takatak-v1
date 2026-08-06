import {
    invalidRequest,
    isRecord,
    isUuid,
    readBoolean,
    readEnumValue,
    readHttpUrl,
    readNullableNumber,
    readOptionalString,
    readRequiredString,
    readTimeZone,
    type ValidationResult,
  } from "@/lib/validation/common";
  
  export const LOCATION_STATUSES = [
    "draft",
    "active",
    "paused",
    "archived",
  ] as const;
  
  export type LocationStatusValue =
    (typeof LOCATION_STATUSES)[number];
  
  export interface LocationInput {
    businessBrandId: string;
    name: string;
    phone: string | null;
    website: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
    timezone: string;
    latitude: number | null;
    longitude: number | null;
    isPrimary: boolean;
    status: LocationStatusValue;
  }
  
  function validatePhone(
    phone: string | null,
    fieldErrors: Record<string, string>,
  ): void {
    if (!phone) {
      return;
    }
  
    const phonePattern =
      /^[0-9+\-().\s#xext]+$/i;
  
    if (!phonePattern.test(phone)) {
      fieldErrors.phone =
        "Phone can contain numbers, spaces, parentheses, plus signs, hyphens, and extensions only.";
    }
  }
  
  export function validateLocationInput(
    value: unknown,
  ): ValidationResult<LocationInput> {
    if (!isRecord(value)) {
      return invalidRequest<LocationInput>(
        {},
        "The location request is invalid.",
      );
    }
  
    const fieldErrors: Record<string, string> = {};
  
    const businessBrandId =
      readRequiredString(
        value,
        "businessBrandId",
        "Brand",
        fieldErrors,
        {
          maximumLength: 36,
        },
      );
  
    if (
      businessBrandId &&
      !isUuid(businessBrandId)
    ) {
      fieldErrors.businessBrandId =
        "Select a valid brand.";
    }
  
    const name = readRequiredString(
      value,
      "name",
      "Location name",
      fieldErrors,
      {
        minimumLength: 2,
        maximumLength: 140,
      },
    );
  
    const phone = readOptionalString(
      value,
      "phone",
      "Phone",
      fieldErrors,
      40,
    );
  
    const website = readHttpUrl(
      value,
      "website",
      "Website",
      fieldErrors,
    );
  
    const addressLine1 =
      readRequiredString(
        value,
        "addressLine1",
        "Address line 1",
        fieldErrors,
        {
          minimumLength: 2,
          maximumLength: 180,
        },
      );
  
    const addressLine2 =
      readOptionalString(
        value,
        "addressLine2",
        "Address line 2",
        fieldErrors,
        180,
      );
  
    const city = readRequiredString(
      value,
      "city",
      "City",
      fieldErrors,
      {
        minimumLength: 2,
        maximumLength: 100,
      },
    );
  
    const region = readOptionalString(
      value,
      "region",
      "Province or region",
      fieldErrors,
      100,
    );
  
    const postalCode =
      readOptionalString(
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
        minimumLength: 2,
        maximumLength: 100,
      },
    );
  
    const timezone = readTimeZone(
      value,
      "timezone",
      fieldErrors,
    );
  
    const latitude = readNullableNumber(
      value,
      "latitude",
      "Latitude",
      fieldErrors,
      -90,
      90,
    );
  
    const longitude =
      readNullableNumber(
        value,
        "longitude",
        "Longitude",
        fieldErrors,
        -180,
        180,
      );
  
    if (
      (latitude === null) !==
      (longitude === null)
    ) {
      fieldErrors.latitude =
        "Latitude and longitude must be entered together.";
  
      fieldErrors.longitude =
        "Latitude and longitude must be entered together.";
    }
  
    const isPrimary = readBoolean(
      value,
      "isPrimary",
      fieldErrors,
    );
  
    const status = readEnumValue(
      value,
      "status",
      "Location status",
      fieldErrors,
      LOCATION_STATUSES,
    );
  
    validatePhone(phone, fieldErrors);
  
    if (
      Object.keys(fieldErrors).length > 0
    ) {
      return invalidRequest<LocationInput>(
        fieldErrors,
      );
    }
  
    return {
      success: true,
      data: {
        businessBrandId,
        name,
        phone,
        website,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        timezone,
        latitude,
        longitude,
        isPrimary,
        status,
      },
    };
  }