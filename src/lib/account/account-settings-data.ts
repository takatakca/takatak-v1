import "server-only";

import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type { AccountLanguage, WeekStartsOn } from "@/lib/account/account-settings-validation";

export type AccountSettingsTab = "account" | "access" | "billing" | "integrations" | "api";

export function readAccountSettingsTab(
  value: string | string[] | undefined,
): AccountSettingsTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (
    tab === "access" ||
    tab === "billing" ||
    tab === "integrations" ||
    tab === "api"
  ) {
    return tab;
  }
  return "account";
}

export type AccountSettingsPageData =
  | {
      source: "database";
      profileId: string;
      email: string;
      phone: string | null;
      firstName: string;
      lastName: string;
      displayName: string | null;
      language: AccountLanguage;
      timezone: string;
      weekStartsOn: WeekStartsOn;
      monthlySummaryEnabled: boolean;
      monthlySummaryEmail: string;
      planName: string;
      apiAccess: boolean;
      ownedWorkspaceNames: string[];
      mfaEnabled: boolean;
      mfaFactorId: string | null;
      mfaAvailable: boolean;
    }
  | {
      source: "unavailable";
      message: string;
    };

function asLanguage(value: string): AccountLanguage {
  return value === "en" ? "en" : "en";
}

function asWeekStart(value: string): WeekStartsOn {
  return value === "monday" ? "monday" : "sunday";
}

export async function getAccountSettingsPageData(
  access: Extract<TenantAccess, { mode: "client_scoped" | "platform_admin" }>,
): Promise<AccountSettingsPageData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "The database is temporarily unavailable.",
    };
  }

  try {
    const [profile, subscription] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: access.profileId },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          displayName: true,
          language: true,
          timezone: true,
          weekStartsOn: true,
          monthlySummaryEnabled: true,
          monthlySummaryEmail: true,
          memberships: {
            where: { role: "owner" },
            select: {
              client: {
                select: { name: true },
              },
            },
          },
        },
      }),
      access.mode === "client_scoped"
        ? prisma.clientSubscription.findUnique({
            where: { clientId: access.activeClientId },
            select: {
              status: true,
              planCode: true,
              planName: true,
              cancelAtPeriodEnd: true,
              currentPeriodEnd: true,
              xAccountAllowance: true,
              advancedAnalytics: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!profile) {
      return {
        source: "unavailable",
        message: "Your account profile could not be loaded.",
      };
    }

    const supabase = await createSupabaseServerClient({
      persistSessionCookies: false,
    });

    let mfaEnabled = false;
    let mfaFactorId: string | null = null;
    let mfaAvailable = true;

    if (supabase) {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) {
        mfaAvailable = false;
      } else {
        const verified =
          (factors.data.totp ?? []).find(
            (factor) => factor.status === "verified",
          ) ?? null;
        mfaEnabled = Boolean(verified);
        mfaFactorId = verified?.id ?? null;
      }
    } else {
      mfaAvailable = false;
    }

    const { entitlements } = resolveEffectiveSocialEntitlements({
      status: subscription?.status,
      planCode: subscription?.planCode,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      addOns: {
        xAccountAllowance: subscription?.xAccountAllowance ?? 0,
        advancedAnalytics: subscription?.advancedAnalytics ?? false,
      },
    });

    return {
      source: "database",
      profileId: profile.id,
      email: profile.email,
      phone: profile.phone,
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      displayName: profile.displayName,
      language: asLanguage(profile.language),
      timezone: profile.timezone,
      weekStartsOn: asWeekStart(profile.weekStartsOn),
      monthlySummaryEnabled: profile.monthlySummaryEnabled,
      monthlySummaryEmail: profile.monthlySummaryEmail ?? "",
      planName: entitlements.planName,
      apiAccess: entitlements.apiAccess,
      ownedWorkspaceNames: profile.memberships.map(
        (membership) => membership.client.name,
      ),
      mfaEnabled,
      mfaFactorId,
      mfaAvailable,
    };
  } catch (error) {
    console.error(
      "[account-settings] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Account settings could not be loaded.",
    };
  }
}
