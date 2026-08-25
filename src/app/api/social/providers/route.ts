import { NextResponse } from "next/server";

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
    const providers =
      Object.values(
        SOCIAL_PROVIDER_REGISTRY,
      ).map((definition) => {
        const readiness =
          getSocialProviderReadiness(
            definition.provider as SocialConnectionProviderValue,
          );

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
            readiness.connectable,

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
          // Facebook / Instagram / Threads are not independent providers.
          {
            facebook: {
              independentlyImplemented: false,
              representedThrough: "meta",
              role: "primary_oauth_card",
            },
            instagram: {
              independentlyImplemented: false,
              representedThrough: "meta",
              role: "represented_through_meta",
            },
            threads: {
              independentlyImplemented: false,
              representedThrough: "meta",
              role: "represented_through_meta",
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
