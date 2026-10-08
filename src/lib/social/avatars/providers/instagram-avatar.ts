import "server-only";

import { getInstagramGraphApiVersion } from "@/lib/social/providers/instagram-oauth";
import type { SocialAvatarProviderContext } from "@/lib/social/avatars/social-avatar-provider-context";
import {
  fetchProviderProfile,
  readProviderString,
} from "@/lib/social/avatars/providers/provider-profile-fetch";
import { isFacebookHostedImageUrl } from "@/lib/social/media/remote-image";

export async function resolveInstagramAvatarSource(
  context: SocialAvatarProviderContext,
): Promise<string | null> {
  if (
    context.platform !== "instagram" ||
    context.connectionProvider !== "instagram"
  ) {
    return null;
  }

  const url = new URL(
    `https://graph.instagram.com/${getInstagramGraphApiVersion()}/me`,
  );

  url.searchParams.set(
    "fields",
    "user_id,id,profile_picture_url",
  );
  url.searchParams.set("access_token", context.accessToken);

  const profile = await fetchProviderProfile(url);
  if (!profile) return null;

  const returnedAccountId =
    readProviderString(profile, "user_id") ||
    readProviderString(profile, "id");

  if (
    !returnedAccountId ||
    returnedAccountId !== context.externalAccountId
  ) {
    return null;
  }

  const profileImageUrl = readProviderString(
    profile,
    "profile_picture_url",
  );

  return isFacebookHostedImageUrl(profileImageUrl)
    ? profileImageUrl
    : null;
}
