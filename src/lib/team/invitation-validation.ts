import {
    ALL_PERMISSIONS,
    isRoleKey,
    type Permission,
    type RoleKey,
  } from "@/lib/security/roles";
  import { normalizeEmail } from "@/lib/auth/registration-validation";
  
  const EMAIL_PATTERN =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  export type InvitationInput = {
    email: string;
    role: RoleKey;
    customPermissions: Permission[];
    deniedPermissions: Permission[];
  };
  
  export type InvitationValidationResult =
    | {
        success: true;
        data: InvitationInput;
      }
    | {
        success: false;
        error: string;
      };
  
  function parsePermissionList(
    value: unknown,
  ): Permission[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
  
    const permissions = new Set<Permission>();
  
    for (const item of value) {
      if (
        typeof item !== "string" ||
        !ALL_PERMISSIONS.includes(item as Permission)
      ) {
        return null;
      }
  
      permissions.add(item as Permission);
    }
  
    return Array.from(permissions);
  }
  
  export function validateInvitationInput(
    input: unknown,
  ): InvitationValidationResult {
    if (
      typeof input !== "object" ||
      input === null
    ) {
      return {
        success: false,
        error: "Invalid invitation request.",
      };
    }
  
    const rawInput = input as {
      email?: unknown;
      role?: unknown;
      customPermissions?: unknown;
      deniedPermissions?: unknown;
    };
  
    if (typeof rawInput.email !== "string") {
      return {
        success: false,
        error: "Email address is required.",
      };
    }
  
    const email = normalizeEmail(rawInput.email);
  
    if (
      email.length > 320 ||
      !EMAIL_PATTERN.test(email)
    ) {
      return {
        success: false,
        error: "Enter a valid email address.",
      };
    }
  
    if (!isRoleKey(rawInput.role)) {
      return {
        success: false,
        error: "Select a valid role.",
      };
    }
  
    const customPermissions = parsePermissionList(
      rawInput.customPermissions ?? [],
    );
  
    if (!customPermissions) {
      return {
        success: false,
        error: "One or more granted permissions are invalid.",
      };
    }
  
    const deniedPermissions = parsePermissionList(
      rawInput.deniedPermissions ?? [],
    );
  
    if (!deniedPermissions) {
      return {
        success: false,
        error: "One or more denied permissions are invalid.",
      };
    }
  
    const overlappingPermission =
      customPermissions.find((permission) =>
        deniedPermissions.includes(permission),
      );
  
    if (overlappingPermission) {
      return {
        success: false,
        error:
          "A permission cannot be both granted and denied.",
      };
    }
  
    return {
      success: true,
      data: {
        email,
        role: rawInput.role,
        customPermissions,
        deniedPermissions,
      },
    };
  }