import "server-only";

import type { SocialAvatarProviderContext } from "@/lib/social/avatars/social-avatar-provider-context";
import {
  fetchProviderProfile,
  readProviderString,
} from "@/lib/social/avatars/providers/provider-profile-fetch";
import { isFacebookHostedImageUrl } from "@/lib/social/media/remote-image";

export async function resolveThreadsAvatarSource(
  context: SocialAvatarProviderContext,
): Promise<string | null> {
  if (
    context.platform !== "threads" ||
    context.connectionProvider !== "threads"
  ) {
    return null;
  }

  const url = new URL("https://graph.threads.net/v1.0/me");

  url.searchParams.set(
    "fields",
    "id,threads_profile_picture_url",
  );
  url.searchParams.set("access_token", context.accessToken);

  const profile = await fetchProviderProfile(url);
  if (!profile) return null;

  const returnedAccountId = readProviderString(profile, "id");

  if (
    !returnedAccountId ||
    returnedAccountId !== context.externalAccountId
  ) {
    return null;
  }

  const profileImageUrl = readProviderString(
    profile,
    "threads_profile_picture_url",
  );

  return isFacebookHostedImageUrl(profileImageUrl)
    ? profileImageUrl
    : null;
}
