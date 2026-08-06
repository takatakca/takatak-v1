// Authentication 1.2 — Workspace access resolver.
//
// AUTHORIZATION SOURCES:
//
// 1. Supabase session authenticates the person.
// 2. Profile.role controls platform-level authority.
// 3. ClientMembership.role controls workspace authority.
// 4. Custom and denied permissions belong only to one membership.
// 5. Supabase metadata is never trusted for authorization.

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { getRuntimeInfo } from "@/lib/security/runtime-mode";
import type {
  Permission,
  PlatformRoleKey,
  RoleKey,
} from "@/lib/security/roles";

export type DeniedReason =
  | "not_authenticated"
  | "profile_missing"
  | "profile_disabled"
  | "membership_missing"
  | "membership_suspended"
  | "client_inactive"
  | "client_not_allowed"
  | "database_unavailable"
  | "production_foundation_blocked";

type MembershipAccess = {
  clientId: string;
  clientStatus:
    | "prospect"
    | "active"
    | "paused"
    | "archived";
  role: RoleKey;
  status: "active" | "suspended";
  customPermissions: Permission[];
  deniedPermissions: Permission[];
};

export type TenantAccess =
  | {
      mode: "foundation_demo";
      role: "owner";
      warning: string;
    }
  | {
      mode: "platform_admin";
      profileId: string;
      role: "owner" | "admin";
      allowedClientIds: "all";
      customPermissions: Permission[];
      deniedPermissions: Permission[];
    }
  | {
      mode: "client_scoped";
      profileId: string;
      role: RoleKey;
      allowedClientIds: string[];
      activeClientId: string;
      customPermissions: Permission[];
      deniedPermissions: Permission[];
    }
  | {
      mode: "selection_required";
      profileId: string;
      platformRole: PlatformRoleKey;
      allowedClientIds: string[];
    }
  | {
      mode: "denied";
      reason: DeniedReason;
    };

export interface TenantAccessInput {
  runtime: {
    foundationAllowed: boolean;
    mode: string;
  };
  authenticated: boolean;
  databaseAvailable: boolean;
  profile: {
    id: string;
    role: PlatformRoleKey;
    status: string;
  } | null;
  memberships: MembershipAccess[];
  requestedClientId: string | null;
}

const FOUNDATION_WARNING =
  "Foundation demo mode — no real authentication or tenant isolation is active. Local development only.";

export function computeTenantAccess(
  input: TenantAccessInput,
): TenantAccess {
  if (
    input.runtime.mode ===
    "production_blocked"
  ) {
    return {
      mode: "denied",
      reason:
        "production_foundation_blocked",
    };
  }

  if (input.runtime.foundationAllowed) {
    return {
      mode: "foundation_demo",
      role: "owner",
      warning: FOUNDATION_WARNING,
    };
  }

  if (!input.authenticated) {
    return {
      mode: "denied",
      reason: "not_authenticated",
    };
  }

  if (!input.databaseAvailable) {
    return {
      mode: "denied",
      reason: "database_unavailable",
    };
  }

  if (!input.profile) {
    return {
      mode: "denied",
      reason: "profile_missing",
    };
  }

  if (input.profile.status === "disabled") {
    return {
      mode: "denied",
      reason: "profile_disabled",
    };
  }

  const requestedMembershipRecord =
    input.requestedClientId
      ? input.memberships.find(
          (membership) =>
            membership.clientId ===
            input.requestedClientId,
        ) ?? null
      : null;

  if (
    requestedMembershipRecord?.status ===
      "active" &&
    (requestedMembershipRecord.clientStatus ===
      "paused" ||
      requestedMembershipRecord.clientStatus ===
        "archived")
  ) {
    if (
      input.profile.role === "owner" ||
      input.profile.role === "admin"
    ) {
      return {
        mode: "platform_admin",
        profileId: input.profile.id,
        role: input.profile.role,
        allowedClientIds: "all",
        customPermissions: [],
        deniedPermissions: [],
      };
    }

    return {
      mode: "denied",
      reason: "client_inactive",
    };
  }

  const activeMemberships =
    input.memberships.filter(
      (membership) =>
        membership.status === "active" &&
        membership.clientStatus !== "paused" &&
        membership.clientStatus !==
          "archived",
    );

  const allowedClientIds =
    activeMemberships.map(
      (membership) => membership.clientId,
    );

  const requestedMembership =
    input.requestedClientId
      ? activeMemberships.find(
          (membership) =>
            membership.clientId ===
            input.requestedClientId,
        )
      : null;

  if (requestedMembership) {
    return {
      mode: "client_scoped",
      profileId: input.profile.id,
      role: requestedMembership.role,
      allowedClientIds,
      activeClientId:
        requestedMembership.clientId,
      customPermissions:
        requestedMembership.customPermissions,
      deniedPermissions:
        requestedMembership.deniedPermissions,
    };
  }

  if (
    input.profile.role === "owner" ||
    input.profile.role === "admin"
  ) {
    return {
      mode: "platform_admin",
      profileId: input.profile.id,
      role: input.profile.role,
      allowedClientIds: "all",
      customPermissions: [],
      deniedPermissions: [],
    };
  }

  if (activeMemberships.length === 0) {
    const hasInactiveWorkspace =
      input.memberships.some(
        (membership) =>
          membership.status === "active" &&
          (membership.clientStatus ===
            "paused" ||
            membership.clientStatus ===
              "archived"),
      );

    const hasSuspendedMembership =
      input.memberships.some(
        (membership) =>
          membership.status === "suspended",
      );

    return {
      mode: "denied",
      reason: hasInactiveWorkspace
        ? "client_inactive"
        : hasSuspendedMembership
          ? "membership_suspended"
          : "membership_missing",
    };
  }

  if (input.requestedClientId) {
    return {
      mode: "denied",
      reason: "client_not_allowed",
    };
  }

  if (activeMemberships.length === 1) {
    const membership =
      activeMemberships[0];

    return {
      mode: "client_scoped",
      profileId: input.profile.id,
      role: membership.role,
      allowedClientIds,
      activeClientId:
        membership.clientId,
      customPermissions:
        membership.customPermissions,
      deniedPermissions:
        membership.deniedPermissions,
    };
  }

  return {
    mode: "selection_required",
    profileId: input.profile.id,
    platformRole: input.profile.role,
    allowedClientIds,
  };
}

export async function resolveTenantAccess(
  requestedClientId?: string | null,
): Promise<TenantAccess> {
  const runtime = getRuntimeInfo();

  if (
    runtime.mode === "production_blocked" ||
    runtime.foundationAllowed
  ) {
    return computeTenantAccess({
      runtime,
      authenticated: false,
      databaseAvailable: false,
      profile: null,
      memberships: [],
      requestedClientId: null,
    });
  }

  const user = await getSessionUser();
  const prisma = getPrisma();

  if (!user || !prisma) {
    return computeTenantAccess({
      runtime,
      authenticated: Boolean(user),
      databaseAvailable: Boolean(prisma),
      profile: null,
      memberships: [],
      requestedClientId: null,
    });
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
          memberships: {
            select: {
              clientId: true,
              client: {
                select: {
                  status: true,
                },
              },
              role: true,
              status: true,
              customPermissions: true,
              deniedPermissions: true,
            },
          },
        },
      });

    return computeTenantAccess({
      runtime,
      authenticated: true,
      databaseAvailable: true,
      profile: profile
        ? {
            id: profile.id,
            role: profile.role,
            status: profile.status,
          }
        : null,
      memberships:
        profile?.memberships.map(
          (membership) => ({
            clientId: membership.clientId,
            clientStatus:
              membership.client.status,
            role: membership.role,
            status: membership.status,
            customPermissions:
              membership.customPermissions,
            deniedPermissions:
              membership.deniedPermissions,
          }),
        ) ?? [],
      requestedClientId:
        requestedClientId ?? null,
    });
  } catch (error) {
    console.error(
      "[tenant-access] Access resolution failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      mode: "denied",
      reason: "database_unavailable",
    };
  }
}



// // Authentication 1.2 — Workspace access resolver.
// //
// // AUTHORIZATION SOURCES:
// //
// // 1. Supabase session authenticates the person.
// // 2. Profile.role controls platform-level authority.
// // 3. ClientMembership.role controls workspace authority.
// // 4. Custom and denied permissions belong only to one membership.
// // 5. Supabase metadata is never trusted for authorization.

// import { getSessionUser } from "@/lib/auth/supabase-server";
// import { getPrisma } from "@/lib/db/prisma";
// import type {
//   Permission,
//   PlatformRoleKey,
//   RoleKey,
// } from "@/lib/security/roles";
// import { getRuntimeInfo } from "@/lib/security/runtime-mode";

// export type DeniedReason =
//   | "not_authenticated"
//   | "profile_missing"
//   | "profile_disabled"
//   | "membership_missing"
//   | "membership_suspended"
//   | "client_not_allowed"
//   | "database_unavailable"
//   | "production_foundation_blocked";

// type MembershipAccess = {
//   clientId: string;
//   role: RoleKey;
//   status: "active" | "suspended";
//   customPermissions: Permission[];
//   deniedPermissions: Permission[];
// };

// export type TenantAccess =
//   | {
//       mode: "foundation_demo";
//       role: "owner";
//       warning: string;
//     }
//   | {
//       mode: "platform_admin";
//       profileId: string;
//       role: "owner" | "admin";
//       allowedClientIds: "all";
//       customPermissions: Permission[];
//       deniedPermissions: Permission[];
//     }
//   | {
//       mode: "client_scoped";
//       profileId: string;
//       role: RoleKey;
//       allowedClientIds: string[];
//       activeClientId: string;
//       customPermissions: Permission[];
//       deniedPermissions: Permission[];
//     }
//   | {
//       mode: "selection_required";
//       profileId: string;
//       platformRole: PlatformRoleKey;
//       allowedClientIds: string[];
//     }
//   | {
//       mode: "denied";
//       reason: DeniedReason;
//     };

// export interface TenantAccessInput {
//   runtime: {
//     foundationAllowed: boolean;
//     mode: string;
//   };
//   authenticated: boolean;
//   databaseAvailable: boolean;
//   profile: {
//     id: string;
//     role: PlatformRoleKey;
//     status: string;
//   } | null;
//   memberships: MembershipAccess[];
//   requestedClientId: string | null;
// }

// const FOUNDATION_WARNING =
//   "Foundation demo mode — no real authentication or tenant isolation is active. Local development only.";

// export function computeTenantAccess(
//   input: TenantAccessInput,
// ): TenantAccess {
//   if (
//     input.runtime.mode ===
//     "production_blocked"
//   ) {
//     return {
//       mode: "denied",
//       reason:
//         "production_foundation_blocked",
//     };
//   }

//   if (input.runtime.foundationAllowed) {
//     return {
//       mode: "foundation_demo",
//       role: "owner",
//       warning: FOUNDATION_WARNING,
//     };
//   }

//   if (!input.authenticated) {
//     return {
//       mode: "denied",
//       reason: "not_authenticated",
//     };
//   }

//   if (!input.databaseAvailable) {
//     return {
//       mode: "denied",
//       reason: "database_unavailable",
//     };
//   }

//   if (!input.profile) {
//     return {
//       mode: "denied",
//       reason: "profile_missing",
//     };
//   }

//   if (
//     input.profile.status === "disabled"
//   ) {
//     return {
//       mode: "denied",
//       reason: "profile_disabled",
//     };
//   }

//   const activeMemberships =
//     input.memberships.filter(
//       (membership) =>
//         membership.status === "active",
//     );

//   const allowedClientIds =
//     activeMemberships.map(
//       (membership) =>
//         membership.clientId,
//     );

//   const requestedMembership =
//     input.requestedClientId
//       ? activeMemberships.find(
//           (membership) =>
//             membership.clientId ===
//             input.requestedClientId,
//         )
//       : null;

//   /*
//    * A selected and validated workspace always produces
//    * workspace-scoped authority.
//    *
//    * Platform role does not replace the selected
//    * membership's workspace role.
//    */
//   if (requestedMembership) {
//     return {
//       mode: "client_scoped",
//       profileId: input.profile.id,
//       role: requestedMembership.role,
//       allowedClientIds,
//       activeClientId:
//         requestedMembership.clientId,
//       customPermissions:
//         requestedMembership.customPermissions,
//       deniedPermissions:
//         requestedMembership.deniedPermissions,
//     };
//   }

//   /*
//    * When no workspace is selected, a Platform Owner or
//    * Platform Admin may enter platform administration.
//    *
//    * Package 2 will add a separate platform-admin resolver
//    * so admin routes do not depend on workspace selection.
//    */
//   if (
//     input.profile.role === "owner" ||
//     input.profile.role === "admin"
//   ) {
//     return {
//       mode: "platform_admin",
//       profileId: input.profile.id,
//       role: input.profile.role,
//       allowedClientIds: "all",
//       customPermissions: [],
//       deniedPermissions: [],
//     };
//   }

//   if (activeMemberships.length === 0) {
//     const hasSuspendedMembership =
//       input.memberships.length > 0;

//     return {
//       mode: "denied",
//       reason: hasSuspendedMembership
//         ? "membership_suspended"
//         : "membership_missing",
//     };
//   }

//   if (input.requestedClientId) {
//     return {
//       mode: "denied",
//       reason: "client_not_allowed",
//     };
//   }

//   if (activeMemberships.length === 1) {
//     const membership =
//       activeMemberships[0];

//     return {
//       mode: "client_scoped",
//       profileId: input.profile.id,
//       role: membership.role,
//       allowedClientIds,
//       activeClientId:
//         membership.clientId,
//       customPermissions:
//         membership.customPermissions,
//       deniedPermissions:
//         membership.deniedPermissions,
//     };
//   }

//   return {
//     mode: "selection_required",
//     profileId: input.profile.id,
//     platformRole: input.profile.role,
//     allowedClientIds,
//   };
// }

// export async function resolveTenantAccess(
//   requestedClientId?: string | null,
// ): Promise<TenantAccess> {
//   const runtime = getRuntimeInfo();

//   if (
//     runtime.mode ===
//       "production_blocked" ||
//     runtime.foundationAllowed
//   ) {
//     return computeTenantAccess({
//       runtime,
//       authenticated: false,
//       databaseAvailable: false,
//       profile: null,
//       memberships: [],
//       requestedClientId: null,
//     });
//   }

//   const user = await getSessionUser();
//   const prisma = getPrisma();

//   if (!user || !prisma) {
//     return computeTenantAccess({
//       runtime,
//       authenticated: Boolean(user),
//       databaseAvailable:
//         Boolean(prisma),
//       profile: null,
//       memberships: [],
//       requestedClientId: null,
//     });
//   }

//   try {
//     const profile =
//       await prisma.profile.findUnique({
//         where: {
//           authUserId: user.id,
//         },
//         select: {
//           id: true,
//           role: true,
//           status: true,
//           memberships: {
//             select: {
//               clientId: true,
//               role: true,
//               status: true,
//               customPermissions: true,
//               deniedPermissions: true,
//             },
//           },
//         },
//       });

//     return computeTenantAccess({
//       runtime,
//       authenticated: true,
//       databaseAvailable: true,
//       profile: profile
//         ? {
//             id: profile.id,
//             role: profile.role,
//             status: profile.status,
//           }
//         : null,
//       memberships:
//         profile?.memberships ?? [],
//       requestedClientId:
//         requestedClientId ?? null,
//     });
//   } catch (error) {
//     console.error(
//       "[tenant-access] Access resolution failed:",
//       error instanceof Error
//         ? error.message
//         : "Unknown error",
//     );

//     return {
//       mode: "denied",
//       reason: "database_unavailable",
//     };
//   }
// }