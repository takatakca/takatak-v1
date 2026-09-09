import "server-only";

import {
  resolveEffectiveSocialEntitlements,
  type SocialEntitlements,
  type SocialPlanCode,
  type SocialSubscriptionAccess,
} from "@/lib/billing/social";
import { previewSocialBrandAllowance } from "@/lib/billing/social/brand-allowance";
import { isSocialStripeAddonCheckoutLive, isSocialStripeCheckoutLive } from "@/lib/billing/social/stripe-env";
import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export type PlansBillingPageData =
  | {
      source: "database";
      workspaceName: string;
      companyName: string;
      vatTaxId: string;
      billingAddress: string;
      billingCountry: string;
      invoiceEmails: string[];
      planCode: SocialPlanCode;
      planName: string;
      subscriptionStatus: string;
      subscriptionStatusLabel: string;
      subscriptionAccess: SocialSubscriptionAccess;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string | null;
      entitlements: SocialEntitlements;
      brandCount: number;
      brandFreeze: {
        allowance: number;
        billableCount: number;
        frozenCount: number;
        overAllowance: boolean;
        needsSelection: boolean;
        canAutoRestore: boolean;
        defaultKeepIds: string[];
        brands: Array<{
          id: string;
          name: string;
          status: string;
          createdAt: string;
        }>;
      };
      xAccountCount: number;
      checkoutLive: boolean;
      addonCheckoutLive: boolean;
      stripeCustomerReady: boolean;
      stripeSubscriptionReady: boolean;
    }
  | {
      source: "unavailable";
      message: string;
    };

export async function getPlansBillingPageData(
  access: ClientScopedAccess,
): Promise<PlansBillingPageData> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      source: "unavailable",
      message: "Billing data is temporarily unavailable.",
    };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: access.activeClientId },
      select: {
        name: true,
        email: true,
        companyName: true,
        vatTaxId: true,
        billingAddress: true,
        billingCountry: true,
        invoiceEmails: true,
        subscription: {
          select: {
            status: true,
            planCode: true,
            planName: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
            xAccountAllowance: true,
            advancedAnalytics: true,
            externalCustomerId: true,
            externalSubscriptionId: true,
          },
        },
      },
    });

    if (!client) {
      return {
        source: "unavailable",
        message: "The selected workspace could not be found.",
      };
    }

    const [brandFreeze, xAccountCount] = await Promise.all([
      previewSocialBrandAllowance(access.activeClientId),
      prisma.socialAccount.count({
        where: {
          clientId: access.activeClientId,
          platform: "x",
          status: "connected",
        },
      }),
    ]);

    const { lifecycle, entitlements } = resolveEffectiveSocialEntitlements({
      status: client.subscription?.status,
      planCode: client.subscription?.planCode,
      cancelAtPeriodEnd: client.subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: client.subscription?.currentPeriodEnd,
      addOns: {
        xAccountAllowance: client.subscription?.xAccountAllowance ?? 0,
        advancedAnalytics: client.subscription?.advancedAnalytics ?? false,
      },
    });

    const invoiceEmails =
      client.invoiceEmails.length > 0
        ? client.invoiceEmails
        : [client.email].filter((email): email is string => Boolean(email?.trim()));

    return {
      source: "database",
      workspaceName: client.name,
      companyName: client.companyName?.trim() || client.name,
      vatTaxId: client.vatTaxId ?? "",
      billingAddress: client.billingAddress ?? "",
      billingCountry: client.billingCountry || "Canada",
      invoiceEmails,
      planCode: entitlements.planCode,
      planName: entitlements.planName,
      subscriptionStatus: lifecycle.status ?? "missing",
      subscriptionStatusLabel: lifecycle.label,
      subscriptionAccess: lifecycle.access,
      cancelAtPeriodEnd: Boolean(client.subscription?.cancelAtPeriodEnd),
      currentPeriodEnd:
        client.subscription?.currentPeriodEnd?.toISOString() ?? null,
      entitlements,
      brandCount: brandFreeze.billableCount,
      brandFreeze: {
        allowance: brandFreeze.allowance,
        billableCount: brandFreeze.billableCount,
        frozenCount: brandFreeze.frozenCount,
        overAllowance: brandFreeze.overAllowance,
        needsSelection: brandFreeze.needsSelection,
        canAutoRestore: brandFreeze.canAutoRestore,
        defaultKeepIds: brandFreeze.defaultKeepIds,
        brands: brandFreeze.brands,
      },
      xAccountCount,
      checkoutLive: isSocialStripeCheckoutLive(),
      addonCheckoutLive: isSocialStripeAddonCheckoutLive(),
      stripeCustomerReady: Boolean(client.subscription?.externalCustomerId),
      stripeSubscriptionReady: Boolean(
        client.subscription?.externalSubscriptionId,
      ),
    };
  } catch (error) {
    console.error(
      "[plans-billing] Query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      source: "unavailable",
      message: "Plans and billing could not be loaded.",
    };
  }
}
