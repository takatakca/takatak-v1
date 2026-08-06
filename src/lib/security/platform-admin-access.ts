import { cache } from "react";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { getRuntimeInfo } from "@/lib/security/runtime-mode";
import type { PlatformRoleKey } from "@/lib/security/roles";

export type PlatformAdminRole = Extract<
  PlatformRoleKey,
  "owner" | "admin"
>;

export type PlatformAdminDeniedReason =
  | "not_authenticated"
  | "database_unavailable"
  | "profile_missing"
  | "profile_disabled"
  | "insufficient_role"
  | "production_foundation_blocked";

export type PlatformAdminAccess =
  | {
      mode: "foundation_demo";
      enforced: false;
      profileId: null;
      role: null;
    }
  | {
      mode: "authorized";
      enforced: true;
      profileId: string;
      role: PlatformAdminRole;
    }
  | {
      mode: "denied";
      enforced: true;
      profileId: string | null;
      role: null;
      reason: PlatformAdminDeniedReason;
    };

export const getPlatformAdminAccess = cache(
  async (): Promise<PlatformAdminAccess> => {
    const runtime = getRuntimeInfo();

    if (
      runtime.mode ===
      "production_blocked"
    ) {
      return {
        mode: "denied",
        enforced: true,
        profileId: null,
        role: null,
        reason:
          "production_foundation_blocked",
      };
    }

    if (runtime.foundationAllowed) {
      return {
        mode: "foundation_demo",
        enforced: false,
        profileId: null,
        role: null,
      };
    }

    const user = await getSessionUser();

    if (!user) {
      return {
        mode: "denied",
        enforced: true,
        profileId: null,
        role: null,
        reason: "not_authenticated",
      };
    }

    const prisma = getPrisma();

    if (!prisma) {
      return {
        mode: "denied",
        enforced: true,
        profileId: null,
        role: null,
        reason:
          "database_unavailable",
      };
    }

    try {
      const profile =
        await prisma.profile.findUnique({
          where: {
            authUserId: user.id,
          },
          select: {
            id: true,
            role: true,
            status: true,
          },
        });

      if (!profile) {
        return {
          mode: "denied",
          enforced: true,
          profileId: null,
          role: null,
          reason: "profile_missing",
        };
      }

      if (
        profile.status === "disabled"
      ) {
        return {
          mode: "denied",
          enforced: true,
          profileId: profile.id,
          role: null,
          reason: "profile_disabled",
        };
      }

      if (
        profile.role !== "owner" &&
        profile.role !== "admin"
      ) {
        return {
          mode: "denied",
          enforced: true,
          profileId: profile.id,
          role: null,
          reason:
            "insufficient_role",
        };
      }

      return {
        mode: "authorized",
        enforced: true,
        profileId: profile.id,
        role: profile.role,
      };
    } catch (error) {
      console.error(
        "[platform-admin-access] Access resolution failed:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );

      return {
        mode: "denied",
        enforced: true,
        profileId: null,
        role: null,
        reason:
          "database_unavailable",
      };
    }
  },
);