import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { downloadSocialAvatar } from "@/lib/social/avatars/social-avatar-download";
import {
  buildSocialAvatarStorageKey,
  readStoredSocialAvatar,
  writeStoredSocialAvatar,
  type StoredSocialAvatar,
} from "@/lib/social/avatars/social-avatar-storage";
import { loadSocialAvatarProviderContext } from "@/lib/social/avatars/social-avatar-provider-context";
import { resolveInstagramAvatarSource } from "@/lib/social/avatars/providers/instagram-avatar";
import { resolveThreadsAvatarSource } from "@/lib/social/avatars/providers/threads-avatar";

const AVATAR_FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 500;

type AvatarAccountRecord = {
  id: string;
  clientId: string;
  platform: string;
  avatarStorageKey: string | null;
  avatarSyncedAt: Date | null;
};

function errorMessage(error: unknown): string {
  return (
    error instanceof Error
      ? error.message
      : "Social avatar synchronization failed."
  ).slice(0, MAX_ERROR_LENGTH);
}

function isFresh(value: Date | null): boolean {
  return Boolean(
    value &&
    Date.now() - value.getTime() < AVATAR_FRESH_MS,
  );
}

async function resolveProviderSource(options: {
  clientId: string;
  accountId: string;
}): Promise<{
  context: Awaited<
    ReturnType<typeof loadSocialAvatarProviderContext>
  >;
  sourceUrl: string | null;
}> {
  const context = await loadSocialAvatarProviderContext(options);
  if (!context) {
    return { context: null, sourceUrl: null };
  }

  if (context.platform === "instagram") {
    return {
      context,
      sourceUrl: await resolveInstagramAvatarSource(context),
    };
  }

  if (context.platform === "threads") {
    return {
      context,
      sourceUrl: await resolveThreadsAvatarSource(context),
    };
  }

  return { context, sourceUrl: null };
}

export async function synchronizeSocialAvatar(options: {
  clientId: string;
  accountId: string;
}): Promise<StoredSocialAvatar | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const resolved = await resolveProviderSource(options);

    if (!resolved.context || !resolved.sourceUrl) {
      throw new Error(
        "The provider did not return an independent profile image.",
      );
    }

    const downloaded = await downloadSocialAvatar(
      resolved.sourceUrl,
    );

    const storageKey = buildSocialAvatarStorageKey({
      clientId: resolved.context.clientId,
      platform: resolved.context.platform,
      accountId: resolved.context.accountId,
      contentType: downloaded.contentType,
    });

    await writeStoredSocialAvatar({
      storageKey,
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
    });

    await prisma.socialAccount.update({
      where: { id: resolved.context.accountId },
      data: {
        profileImageUrl: resolved.sourceUrl,
        avatarStorageKey: storageKey,
        avatarContentType: downloaded.contentType,
        avatarByteSize: downloaded.bytes.byteLength,
        avatarSourceUrl: resolved.sourceUrl,
        avatarSyncedAt: new Date(),
        avatarSyncError: null,
      },
    });

    return {
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
      byteSize: downloaded.bytes.byteLength,
      etag: null,
    };
  } catch (error) {
    await prisma.socialAccount
      .updateMany({
        where: {
          id: options.accountId,
          clientId: options.clientId,
        },
        data: {
          avatarSyncError: errorMessage(error),
        },
      })
      .catch(() => null);

    return null;
  }
}

async function readCachedAvatar(
  account: AvatarAccountRecord,
): Promise<StoredSocialAvatar | null> {
  if (!account.avatarStorageKey) return null;

  try {
    return await readStoredSocialAvatar(
      account.avatarStorageKey,
    );
  } catch {
    return null;
  }
}

export async function getSocialAvatar(options: {
  clientId: string;
  accountId: string;
}): Promise<StoredSocialAvatar | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.accountId,
      clientId: options.clientId,
      status: "connected",
    },
    select: {
      id: true,
      clientId: true,
      platform: true,
      avatarStorageKey: true,
      avatarSyncedAt: true,
    },
  });

  if (!account) return null;

  const cached = await readCachedAvatar(account);

  if (cached && isFresh(account.avatarSyncedAt)) {
    return cached;
  }

  const synchronized = await synchronizeSocialAvatar({
    clientId: account.clientId,
    accountId: account.id,
  });

  return synchronized ?? cached;
}
