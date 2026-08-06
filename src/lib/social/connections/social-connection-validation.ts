import { isSocialConnectionProvider } from "@/lib/social/providers/registry";
import type { SocialConnectionProviderValue } from "@/lib/social/providers/types";
import { isUuid } from "@/lib/validation/common";

export type CreateSocialOAuthStateInput = {
  provider: SocialConnectionProviderValue;
  businessBrandId: string;
  returnPath: string;
};

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      message: string;
      fieldErrors: Record<
        string,
        string
      >;
    };

function isSafeDashboardPath(
  value: string,
): boolean {
  return (
    value.startsWith("/dashboard") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

export function validateCreateSocialOAuthState(
  input: unknown,
): ValidationResult<CreateSocialOAuthStateInput> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return {
      success: false,
      message:
        "The social connection request is invalid.",
      fieldErrors: {},
    };
  }

  const record =
    input as Record<
      string,
      unknown
    >;

  const provider =
    typeof record.provider ===
    "string"
      ? record.provider.trim()
      : "";

  const businessBrandId =
    typeof record.businessBrandId ===
    "string"
      ? record.businessBrandId.trim()
      : "";

  const suppliedReturnPath =
    typeof record.returnPath ===
    "string"
      ? record.returnPath.trim()
      : "";

  const returnPath =
    suppliedReturnPath ||
    "/dashboard/social/accounts";

  const fieldErrors: Record<
    string,
    string
  > = {};

  if (
    !isSocialConnectionProvider(
      provider,
    )
  ) {
    fieldErrors.provider =
      "Select a supported social provider.";
  }

  if (
    !isUuid(businessBrandId)
  ) {
    fieldErrors.businessBrandId =
      "Select a valid brand.";
  }

  if (
    !isSafeDashboardPath(
      returnPath,
    )
  ) {
    fieldErrors.returnPath =
      "The return path is invalid.";
  }

  if (
    Object.keys(fieldErrors)
      .length > 0
  ) {
    return {
      success: false,
      message:
        "Review the social connection fields.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      provider:
        provider as SocialConnectionProviderValue,
      businessBrandId,
      returnPath,
    },
  };
}
