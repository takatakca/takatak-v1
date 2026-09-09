import { NextResponse } from "next/server";

import { loadClientSocialEntitlementContext } from "@/lib/billing/social/entitlement-gates";
import { evaluateSocialNetworkConnect } from "@/lib/billing/social/entitlement-gates-policy";
import { getPrisma } from "@/lib/db/prisma";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import {
  getSocialProviderReadiness,
  SOCIAL_PROVIDER_REGISTRY,
} from "@/lib/social/providers/registry";
import type { SocialConnectionProviderValue } from "@/lib/social/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "view_social",
    );

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const prisma = getPrisma();
    let entitlements = null as Awaited<
      ReturnType<typeof loadClientSocialEntitlementContext>
    >["entitlements"] | null;

    if (prisma) {
      const context = await loadClientSocialEntitlementContext(
        prisma,
        gate.access.activeClientId,
      );
      entitlements = context.entitlements;
    }

    const providers =
      Object.values(
        SOCIAL_PROVIDER_REGISTRY,
      ).map((definition) => {
        const readiness =
          getSocialProviderReadiness(
            definition.provider as SocialConnectionProviderValue,
          );

        const planAllowsConnect = entitlements
          ? evaluateSocialNetworkConnect({
              provider: definition.provider,
              entitlements,
              connectedXCount: 0,
              reconnect: true,
            }).allowed
          : true;

        return {
          provider:
            definition.provider,

          label:
            definition.label,

          description:
            definition.description,

          platforms:
            definition.platforms,

          authorizationType:
            definition.authorizationType,

          implemented:
            readiness.implemented,

          connectable:
            readiness.connectable && planAllowsConnect,

          configured:
            readiness.configured,

          supportsMultipleAccounts:
            readiness.supportsMultipleAccounts,

          state:
            readiness.state,
        };
      });

    return jsonResponse(
      {
        ok: true,
        providers,
        metaPlatformRepresentation:
          {
            facebook: {
              independentlyImplemented: false,
              representedThrough: "meta",
              role: "primary_oauth_card",
            },
            instagram: {
              independentlyImplemented: true,
              representedThrough: "meta",
              role: "meta_primary_or_independent_oauth",
            },
            threads: {
              independentlyImplemented: true,
              representedThrough: "meta",
              role: "meta_primary_or_independent_oauth",
            },
          },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-providers-list",
      error,
      "The social provider catalog could not be loaded.",
    );
  }
}
