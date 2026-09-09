import "server-only";

import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";
import type { InboxPageData } from "@/lib/social/inbox/inbox-types";

export type {
  InboxKind,
  InboxPageData,
  InboxThread,
} from "@/lib/social/inbox/inbox-types";

export async function getSocialInboxData(
  access: ClientScopedAccess,
): Promise<InboxPageData> {
  const brand = await resolveBrandSessionContext(access);
  const active =
    brand.availableBrands.find(
      (item) => item.id === brand.activeBrandId,
    ) ?? null;

  const connectedPlatforms = active?.connectedPlatforms ?? [];
  const attentionPlatforms: string[] = [];

  if (active?.facebookSurface?.attentionRequired) {
    attentionPlatforms.push("facebook");
  }

  return {
    connectedPlatforms,
    attentionPlatforms,
    threads: [],
  };
}
