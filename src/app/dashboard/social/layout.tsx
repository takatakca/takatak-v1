import type { ReactNode } from "react";

import {
  SocialWorkspaceShell,
  type SocialShellAccount,
} from "@/components/social/navigation/social-workspace-shell";
import type {
  ManageConnectionsConnection,
  ManageConnectionsProvider,
} from "@/components/social/connections/manage-connections-modal";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { getSocialConnectionsData } from "@/lib/social/connections/social-connection-data";
import { pickConnectedPlatformAccount } from "@/lib/social/connections/social-selected-page-identity";
import {
  getSocialProviderDefinition,
  listSocialProviderReadiness,
} from "@/lib/social/providers/registry";
import { getPrisma } from "@/lib/db/prisma";
import { toAccountPictureSrc, toClientSocialImageUrl } from "@/lib/social/media/remote-image";

export const dynamic = "force-dynamic";

export default async function SocialLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access =
    await requireWorkspacePermission(
      "view_social",
      "/dashboard/social",
    );

  const brandContext =
    await resolveBrandSessionContext(
      access,
    );

  const prisma = getPrisma();

  let planName: string | null = null;
  let hasPaidPlan = false;
  
  if (prisma) {
    try {
      const client =
        await prisma.client.findUnique({
          where: {
            id: access.activeClientId,
          },
          select: {
            planName: true,
          },
        });
  
      planName =
        client?.planName?.trim() || null;
  
      const normalizedPlan =
        planName?.toLowerCase() ?? null;
  
      hasPaidPlan =
        normalizedPlan !== null &&
        normalizedPlan !== "free" &&
        normalizedPlan !== "trial";
    } catch (error) {
      console.error(
        "[social-layout] Plan status could not be loaded:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
    }
  }  

  const providers: ManageConnectionsProvider[] =
    listSocialProviderReadiness().map(
      (readiness) => {
        const definition =
          getSocialProviderDefinition(
            readiness.provider,
          );

        return {
          provider:
            readiness.provider,
          label: definition.label,
          description:
            definition.description,
          platforms:
            definition.platforms,
          implemented:
            readiness.implemented,
          connectable:
            readiness.connectable,
          configured:
            readiness.configured,
          supportsMultipleAccounts:
            readiness.supportsMultipleAccounts,
          state: readiness.state,
        };
      },
    );

  let connections: ManageConnectionsConnection[] =
    [];

  let accounts: SocialShellAccount[] =
    [];

  let dataUnavailable = false;

  if (brandContext.activeBrandId) {
    try {
      const records =
        await getSocialConnectionsData(
          access.activeClientId,
          brandContext.activeBrandId,
        );

      connections = records.map(
        (connection) => ({
          id: connection.id,
          provider:
            connection.provider,
          status: connection.status,
          brandId:
            connection.brandId,
          brandName:
            connection.brandName,
          accounts:
            connection.accounts.map(
              (account) => ({
                id: account.id,
                platform:
                  account.platform,
                // Page IDs stay server-side; UI uses name/handle only.
                externalAccountId: null,
                handle: account.handle,
                displayName:
                  account.displayName,
                status: account.status,
                accessStatus:
                  account.accessStatus,
                profileImageUrl:
                  account.platform === "facebook"
                    ? toAccountPictureSrc(account.id)
                    : toClientSocialImageUrl(account.profileImageUrl),
              }),
            ),
          lastErrorCode:
            connection.lastErrorCode,
          lastErrorMessage:
            connection.lastErrorMessage,
        }),
      );

      const connectedAccounts = records.flatMap(
        (connection) =>
          connection.accounts
            .filter((account) => {
              if (
                account.status !== "connected" ||
                account.externalAccountId === null
              ) {
                return false;
              }

              if (connection.status === "connected") {
                return true;
              }

              // Keep selected Facebook Page visible when Meta shell needs
              // reconnect attention — matches brand selector + projection.
              return (
                connection.provider === "meta" &&
                account.platform === "facebook" &&
                account.accessStatus === "selected" &&
                (connection.status ===
                  "reauthorization_required" ||
                  connection.status === "authorized" ||
                  connection.status === "failed" ||
                  connection.status === "expired" ||
                  connection.status === "error")
              );
            })
            .map((account) => ({
              id: account.id,
              platform:
                account.platform,
              handle: account.handle,
              displayName:
                account.displayName,
              status: account.status,
              accessStatus:
                account.accessStatus,
              profileImageUrl:
                account.profileImageUrl,
            })),
      );

      // One identity per platform from the persisted selected/connected Page.
      const platforms = [
        ...new Set(
          connectedAccounts.map(
            (account) => account.platform,
          ),
        ),
      ];
      accounts = platforms
        .map((platform) =>
          pickConnectedPlatformAccount(
            connectedAccounts,
            platform,
          ),
        )
        .filter(
          (
            account,
          ): account is NonNullable<
            typeof account
          > => account !== null,
        )
        .map((account) => ({
          id: account.id,
          platform: account.platform,
          handle: account.handle,
          displayName: account.displayName,
          status: account.status,
          profileImageUrl:
            account.platform === "facebook"
              ? toAccountPictureSrc(account.id)
              : toClientSocialImageUrl(account.profileImageUrl),
        }));
    } catch (error) {
      dataUnavailable = true;

      console.error(
        "[social-layout] Social connection data could not be loaded:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
    }
  }

  return (
    <SocialWorkspaceShell
      data={{
        activeBrandId:
          brandContext.activeBrandId,

        activeBrandName:
          brandContext.activeBrandName,

        activeBrandDisplayLabel:
          brandContext.activeBrandDisplayLabel,

        activeBrandDisplayImageUrl:
          brandContext.activeBrandDisplayImageUrl,

        brands:
          brandContext.availableBrands,

        accounts,
        providers,
        connections,

        canManageSocialAccounts:
          hasEffectivePermission(
            access,
            "manage_social_accounts",
          ),

        canManageBrands:
          hasEffectivePermission(
            access,
            "manage_brands",
          ),

        planName,
        hasPaidPlan,  

        dataUnavailable,
      }}
    >
      {children}
    </SocialWorkspaceShell>
  );
}
