import {
    normalizePersonName,
    validateFirstName,
    validateLastName,
    validatePassword,
  } from "@/lib/auth/registration-validation";
  
  export type InvitationCompletionInput = {
    firstName: string;
    lastName: string;
    password: string;
    confirmPassword: string;
  };
  
  export type InvitationCompletionField =
    keyof InvitationCompletionInput;
  
  export type InvitationCompletionFieldErrors =
    Partial<
      Record<
        InvitationCompletionField,
        string
      >
    >;
  
  export type InvitationCompletionValidationResult =
    | {
        success: true;
        data: InvitationCompletionInput & {
          displayName: string;
        };
      }
    | {
        success: false;
        fieldErrors: InvitationCompletionFieldErrors;
        message: string;
      };
  
  export function validateInvitationCompletion(
    input: unknown,
  ): InvitationCompletionValidationResult {
    if (
      typeof input !== "object" ||
      input === null
    ) {
      return {
        success: false,
        fieldErrors: {},
        message:
          "The account completion request is invalid.",
      };
    }
  
    const candidate = input as Record<
      string,
      unknown
    >;
  
    if (
      typeof candidate.firstName !==
        "string" ||
      typeof candidate.lastName !==
        "string" ||
      typeof candidate.password !==
        "string" ||
      typeof candidate.confirmPassword !==
        "string"
    ) {
      return {
        success: false,
        fieldErrors: {},
        message:
          "All account fields are required.",
      };
    }
  
    const firstName =
      normalizePersonName(
        candidate.firstName,
      );
  
    const lastName =
      normalizePersonName(
        candidate.lastName,
      );
  
    const password = candidate.password;
    const confirmPassword =
      candidate.confirmPassword;
  
    const fieldErrors:
      InvitationCompletionFieldErrors = {};
  
    const firstNameError =
      validateFirstName(firstName);
  
    const lastNameError =
      validateLastName(lastName);
  
    const passwordError =
      validatePassword(password);
  
    if (firstNameError) {
      fieldErrors.firstName =
        firstNameError;
    }
  
    if (lastNameError) {
      fieldErrors.lastName =
        lastNameError;
    }
  
    if (passwordError) {
      fieldErrors.password =
        passwordError;
    }
  
    if (!confirmPassword) {
      fieldErrors.confirmPassword =
        "Confirm your password.";
    } else if (
      password !== confirmPassword
    ) {
      fieldErrors.confirmPassword =
        "Passwords do not match.";
    }
  
    if (
      Object.keys(fieldErrors).length > 0
    ) {
      return {
        success: false,
        fieldErrors,
        message:
          "Correct the highlighted account fields.",
      };
    }
  
    return {
      success: true,
      data: {
        firstName,
        lastName,
        password,
        confirmPassword,
        displayName:
          `${firstName} ${lastName}`,
      },
    };
  }