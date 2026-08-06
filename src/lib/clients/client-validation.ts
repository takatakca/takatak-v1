import {
    invalidRequest,
    isRecord,
    readEmail,
    readEnumValue,
    readOptionalString,
    readRequiredString,
    readTimeZone,
    type ValidationResult,
  } from "@/lib/validation/common";
  
  export const CLIENT_STATUSES = [
    "prospect",
    "active",
    "paused",
    "archived",
  ] as const;
  
  export type ClientStatusValue =
    (typeof CLIENT_STATUSES)[number];
  
  export interface ClientCreateInput {
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    planName: string | null;
    timezone: string;
    status: ClientStatusValue;
    ownerEmail: string;
    assignedAdminEmail: string | null;
  }
  
  export interface ClientUpdateInput {
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    planName: string | null;
    timezone: string;
    status: ClientStatusValue;
    assignedAdminEmail: string | null;
  }
  
  function readCommonClientFields(
    value: Record<string, unknown>,
  ): {
    fieldErrors: Record<string, string>;
    data: Omit<
      ClientUpdateInput,
      never
    >;
  } {
    const fieldErrors: Record<string, string> = {};
  
    const name = readRequiredString(
      value,
      "name",
      "Workspace name",
      fieldErrors,
      {
        minimumLength: 2,
        maximumLength: 120,
      },
    );
  
    const companyName = readOptionalString(
      value,
      "companyName",
      "Company name",
      fieldErrors,
      160,
    );
  
    const email = readEmail(
      value,
      "email",
      "Workspace email",
      fieldErrors,
      false,
    );
  
    const phone = readOptionalString(
      value,
      "phone",
      "Phone",
      fieldErrors,
      40,
    );
  
    const planName = readOptionalString(
      value,
      "planName",
      "Plan name",
      fieldErrors,
      100,
    );
  
    const timezone = readTimeZone(
      value,
      "timezone",
      fieldErrors,
    );
  
    const status = readEnumValue(
      value,
      "status",
      "Workspace status",
      fieldErrors,
      CLIENT_STATUSES,
    );
  
    const assignedAdminEmail = readEmail(
      value,
      "assignedAdminEmail",
      "Assigned admin email",
      fieldErrors,
      false,
    );
  
    return {
      fieldErrors,
      data: {
        name,
        companyName,
        email,
        phone,
        planName,
        timezone,
        status,
        assignedAdminEmail,
      },
    };
  }
  
  export function validateClientCreate(
    value: unknown,
  ): ValidationResult<ClientCreateInput> {
    if (!isRecord(value)) {
      return invalidRequest<ClientCreateInput>(
        {},
        "The workspace request is invalid.",
      );
    }
  
    const common =
      readCommonClientFields(value);
  
    const ownerEmail = readEmail(
      value,
      "ownerEmail",
      "Initial owner email",
      common.fieldErrors,
      true,
    );
  
    if (
      Object.keys(common.fieldErrors).length > 0 ||
      !ownerEmail
    ) {
      return invalidRequest<ClientCreateInput>(
        common.fieldErrors,
      );
    }
  
    return {
      success: true,
      data: {
        ...common.data,
        ownerEmail,
      },
    };
  }
  
  export function validateClientUpdate(
    value: unknown,
  ): ValidationResult<ClientUpdateInput> {
    if (!isRecord(value)) {
      return invalidRequest<ClientUpdateInput>(
        {},
        "The workspace request is invalid.",
      );
    }
  
    const common =
      readCommonClientFields(value);
  
    if (
      Object.keys(common.fieldErrors).length > 0
    ) {
      return invalidRequest<ClientUpdateInput>(
        common.fieldErrors,
      );
    }
  
    return {
      success: true,
      data: common.data,
    };
  }

// import type { ClientStatus } from "@prisma/client";

// import {
//   invalidRequest,
//   isRecord,
//   isUuid,
//   readEmail,
//   readEnumValue,
//   readOptionalString,
//   readRequiredString,
//   readTimeZone,
//   type FieldErrors,
//   type ValidationResult,
// } from "@/lib/validation/common";

// export const CLIENT_STATUSES = [
//   "prospect",
//   "active",
//   "paused",
//   "archived",
// ] as const satisfies readonly ClientStatus[];

// export type ClientCreateInput = {
//   name: string;
//   email: string | null;
//   phone: string | null;
//   companyName: string | null;
//   status: ClientStatus;
//   planName: string | null;
//   timezone: string;
//   assignedProfileId: string | null;
//   ownerProfileId: string;
// };

// export type ClientUpdateInput = {
//   name: string;
//   email: string | null;
//   phone: string | null;
//   companyName: string | null;
//   status: ClientStatus;
//   planName: string | null;
//   timezone: string;
//   assignedProfileId: string | null;
// };

// function readOptionalUuid(
//   source: Record<string, unknown>,
//   key: string,
//   label: string,
//   fieldErrors: FieldErrors,
// ): string | null {
//   const value = source[key];

//   if (
//     value === undefined ||
//     value === null ||
//     value === ""
//   ) {
//     return null;
//   }

//   if (
//     typeof value !== "string" ||
//     !isUuid(value.trim())
//   ) {
//     fieldErrors[key] = `${label} is invalid.`;
//     return null;
//   }

//   return value.trim();
// }

// function readRequiredUuid(
//   source: Record<string, unknown>,
//   key: string,
//   label: string,
//   fieldErrors: FieldErrors,
// ): string {
//   const value = source[key];

//   if (
//     typeof value !== "string" ||
//     !isUuid(value.trim())
//   ) {
//     fieldErrors[key] = `${label} is required.`;
//     return "";
//   }

//   return value.trim();
// }

// function validatePhone(
//   phone: string | null,
//   fieldErrors: FieldErrors,
// ): void {
//   if (!phone) {
//     return;
//   }

//   const phonePattern = /^[0-9+\-().\s#xext]+$/i;

//   if (!phonePattern.test(phone)) {
//     fieldErrors.phone =
//       "Phone can contain numbers, spaces, parentheses, plus signs, hyphens, and extensions only.";
//   }
// }

// function readClientFields(
//   source: Record<string, unknown>,
//   fieldErrors: FieldErrors,
// ): ClientUpdateInput {
//   const name = readRequiredString(
//     source,
//     "name",
//     "Workspace name",
//     fieldErrors,
//     {
//       minimumLength: 2,
//       maximumLength: 120,
//     },
//   );

//   const email = readEmail(
//     source,
//     "email",
//     "Workspace email",
//     fieldErrors,
//     false,
//   );

//   const phone = readOptionalString(
//     source,
//     "phone",
//     "Phone",
//     fieldErrors,
//     40,
//   );

//   const companyName = readOptionalString(
//     source,
//     "companyName",
//     "Company name",
//     fieldErrors,
//     160,
//   );

//   const status = readEnumValue(
//     source,
//     "status",
//     "Workspace status",
//     fieldErrors,
//     CLIENT_STATUSES,
//   );

//   const planName = readOptionalString(
//     source,
//     "planName",
//     "Plan name",
//     fieldErrors,
//     100,
//   );

//   const timezone = readTimeZone(
//     source,
//     "timezone",
//     fieldErrors,
//   );

//   const assignedProfileId = readOptionalUuid(
//     source,
//     "assignedProfileId",
//     "Assigned platform administrator",
//     fieldErrors,
//   );

//   validatePhone(phone, fieldErrors);

//   return {
//     name,
//     email,
//     phone,
//     companyName,
//     status,
//     planName,
//     timezone,
//     assignedProfileId,
//   };
// }

// export function validateClientCreateInput(
//   input: unknown,
// ): ValidationResult<ClientCreateInput> {
//   if (!isRecord(input)) {
//     return invalidRequest<ClientCreateInput>(
//       {},
//       "The workspace request is invalid.",
//     );
//   }

//   const fieldErrors: FieldErrors = {};

//   const clientFields = readClientFields(
//     input,
//     fieldErrors,
//   );

//   const ownerProfileId = readRequiredUuid(
//     input,
//     "ownerProfileId",
//     "Workspace owner",
//     fieldErrors,
//   );

//   if (Object.keys(fieldErrors).length > 0) {
//     return invalidRequest<ClientCreateInput>(
//       fieldErrors,
//     );
//   }

//   return {
//     success: true,
//     data: {
//       ...clientFields,
//       ownerProfileId,
//     },
//   };
// }

// export function validateClientUpdateInput(
//   input: unknown,
// ): ValidationResult<ClientUpdateInput> {
//   if (!isRecord(input)) {
//     return invalidRequest<ClientUpdateInput>(
//       {},
//       "The workspace request is invalid.",
//     );
//   }

//   const fieldErrors: FieldErrors = {};

//   const data = readClientFields(
//     input,
//     fieldErrors,
//   );

//   if (Object.keys(fieldErrors).length > 0) {
//     return invalidRequest<ClientUpdateInput>(
//       fieldErrors,
//     );
//   }

//   return {
//     success: true,
//     data,
//   };
// }