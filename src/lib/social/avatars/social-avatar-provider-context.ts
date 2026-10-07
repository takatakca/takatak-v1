import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
} from "@/lib/social/security/social-crypto";

export type SocialAvatarProviderContext = {
  accountId: string;
  clientId: string;
  platform: string;
  externalAccountId: string;
  connectionId: string;
  connectionProvider: string;
  accessToken: string;
};

export async function loadSocialAvatarProviderContext(options: {
  clientId: string;
  accountId: string;
}): Promise<SocialAvatarProviderContext | null> {
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
      externalAccountId: true,
      providerConnection: {
        select: {
          id: true,
          provider: true,
          credential: {
            select: {
              status: true,
              encryptedPayload: true,
              iv: true,
              authTag: true,
              keyVersion: true,
            },
          },
        },
      },
    },
  });

  const connection = account?.providerConnection;
  const credential = connection?.credential;

  if (
    !account ||
    !account.externalAccountId ||
    !connection ||
    !credential ||
    credential.status !== "active"
  ) {
    return null;
  }

  try {
    const payload = decryptSocialTokenPayload(
      {
        ciphertext: credential.encryptedPayload,
        iv: credential.iv,
        authTag: credential.authTag,
        keyVersion: credential.keyVersion,
      },
      buildSocialCredentialAad({
        clientId: account.clientId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );

    return {
      accountId: account.id,
      clientId: account.clientId,
      platform: account.platform,
      externalAccountId: account.externalAccountId,
      connectionId: connection.id,
      connectionProvider: connection.provider,
      accessToken: payload.accessToken,
    };
  } catch {
    return null;
  }
}
