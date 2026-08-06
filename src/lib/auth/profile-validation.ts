import {
    normalizePersonName,
    validateFirstName,
    validateLastName,
  } from "@/lib/auth/registration-validation";
  
  export type ProfileUpdateInput = {
    firstName: string;
    lastName: string;
  };
  
  export type ProfileUpdateFieldErrors = Partial<
    Record<keyof ProfileUpdateInput, string>
  >;
  
  export type ProfileUpdateValidationResult =
    | {
        success: true;
        data: ProfileUpdateInput & {
          displayName: string;
        };
      }
    | {
        success: false;
        fieldErrors: ProfileUpdateFieldErrors;
        message: string;
      };
  
  export function validateProfileUpdate(
    input: unknown,
  ): ProfileUpdateValidationResult {
    if (
      typeof input !== "object" ||
      input === null
    ) {
      return {
        success: false,
        fieldErrors: {},
        message: "The profile request is invalid.",
      };
    }
  
    const rawInput = input as {
      firstName?: unknown;
      lastName?: unknown;
    };
  
    if (
      typeof rawInput.firstName !== "string" ||
      typeof rawInput.lastName !== "string"
    ) {
      return {
        success: false,
        fieldErrors: {},
        message: "First name and last name are required.",
      };
    }
  
    const firstName = normalizePersonName(
      rawInput.firstName,
    );
  
    const lastName = normalizePersonName(
      rawInput.lastName,
    );
  
    const fieldErrors: ProfileUpdateFieldErrors = {};
  
    const firstNameError =
      validateFirstName(firstName);
  
    const lastNameError =
      validateLastName(lastName);
  
    if (firstNameError) {
      fieldErrors.firstName = firstNameError;
    }
  
    if (lastNameError) {
      fieldErrors.lastName = lastNameError;
    }
  
    if (Object.keys(fieldErrors).length > 0) {
      return {
        success: false,
        fieldErrors,
        message:
          "Correct the highlighted profile fields.",
      };
    }
  
    return {
      success: true,
      data: {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
      },
    };
  }