import "server-only";

import type {
  Prisma,
  SocialConnectionProvider,
} from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  createOAuthStateValue,
  createPkceChallenge,
  createPkceVerifier,
  decryptSocialValue,
  encryptSocialTokenPayload,
  encryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";
import {
  getSocialProviderDefinition,
  getSocialProviderReadiness,
} from "@/lib/social/providers/registry";
import type { SocialConnectionProviderValue } from "@/lib/social/providers/types";

const OAUTH_STATE_LIFETIME_MINUTES =
  10;

export type CreatedSocialOAuthState = {
  state: string;
  codeChallenge: string;
  expiresAt: string;
  provider: SocialConnectionProviderValue;
  connectionId: string;
};

function requirePrisma() {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  return prisma;
}

export async function createSocialOAuthState(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  provider: SocialConnectionProviderValue;
  returnPath: string;
}): Promise<CreatedSocialOAuthState> {
  const prisma = requirePrisma();

  const definition =
    getSocialProviderDefinition(
      options.provider,
    );

  const readiness =
    getSocialProviderReadiness(
      options.provider,
    );

  if (!definition.implemented) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not implemented yet.`,
      {
        status: 503,
      },
    );
  }

  if (!readiness.configured) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not configured.`,
      {
        status: 503,
      },
    );
  }

  if (!readiness.connectable) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not enabled yet.`,
      {
        status: 503,
      },
    );
  }

  const brand =
    await prisma.businessBrand.findFirst({
      where: {
        id: options.businessBrandId,
        clientId: options.clientId,
        status: {
          not: "archived",
        },
      },
      select: {
        id: true,
      },
    });

  if (!brand) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found in this workspace.",
    );
  }

  const connection =
    await prisma.socialProviderConnection.upsert({
      where: {
        clientId_businessBrandId_provider:
          {
            clientId:
              options.clientId,
            businessBrandId:
              brand.id,
            provider:
              options.provider as SocialConnectionProvider,
          },
      },
      update: {
        status:
          "pending_authorization",
        lastErrorCode: null,
        lastErrorMessage: null,
        disconnectedAt: null,
        createdByProfileId:
          options.profileId,
      },
      create: {
        clientId:
          options.clientId,
        businessBrandId:
          brand.id,
        provider:
          options.provider as SocialConnectionProvider,
        status:
          "pending_authorization",
        createdByProfileId:
          options.profileId,
      },
      select: {
        id: true,
      },
    });

  const publicState =
    createOAuthStateValue();

  const verifier =
    createPkceVerifier();

  const encryptedVerifier =
    encryptSocialValue(verifier);

  const expiresAt = new Date(
    Date.now() +
      OAUTH_STATE_LIFETIME_MINUTES *
        60 *
        1000,
  );

  await prisma.socialOAuthState.create({
    data: {
      clientId:
        options.clientId,
      businessBrandId:
        brand.id,
      connectionId:
        connection.id,
      provider:
        options.provider as SocialConnectionProvider,
      stateHash:
        hashOAuthState(
          publicState,
        ),
      codeVerifierCiphertext:
        encryptedVerifier.ciphertext,
      codeVerifierIv:
        encryptedVerifier.iv,
      codeVerifierAuthTag:
        encryptedVerifier.authTag,
      returnPath:
        options.returnPath,
      expiresAt,
      createdByProfileId:
        options.profileId,
      metadata: {
        keyVersion:
          encryptedVerifier.keyVersion,
      },
    },
  });

  return {
    state: publicState,
    codeChallenge:
      createPkceChallenge(
        verifier,
      ),
    expiresAt:
      expiresAt.toISOString(),
    provider:
      options.provider,
    connectionId:
      connection.id,
  };
}

function readKeyVersion(
  metadata: Prisma.JsonValue | null,
): number {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return 1;
  }

  const value = (
    metadata as Record<
      string,
      unknown
    >
  ).keyVersion;

  return typeof value ===
      "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : 1;
}

export async function consumeSocialOAuthState(options: {
  provider: SocialConnectionProviderValue;
  state: string;
}): Promise<{
  oauthStateId: string;
  clientId: string;
  businessBrandId: string;
  connectionId: string;
  codeVerifier: string;
  returnPath: string;
}> {
  const prisma = requirePrisma();

  const stateHash =
    hashOAuthState(
      options.state,
    );

  const oauthState =
    await prisma.socialOAuthState.findUnique({
      where: {
        stateHash,
      },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        connectionId: true,
        provider: true,
        status: true,
        stateHash: true,
        codeVerifierCiphertext:
          true,
        codeVerifierIv: true,
        codeVerifierAuthTag:
          true,
        returnPath: true,
        expiresAt: true,
        metadata: true,
      },
    });

  if (
    !oauthState ||
    !verifyOAuthStateHash(
      options.state,
      oauthState.stateHash,
    )
  ) {
    throw new ServiceError(
      "forbidden",
      "The social authorization state is invalid.",
    );
  }

  if (
    oauthState.provider !==
    options.provider
  ) {
    throw new ServiceError(
      "forbidden",
      "The social authorization provider does not match the request.",
    );
  }

  if (
    oauthState.status !==
    "pending"
  ) {
    throw new ServiceError(
      "conflict",
      "This social authorization request has already been used.",
    );
  }

  if (
    oauthState.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.socialOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: "expired",
      },
    });

    throw new ServiceError(
      "forbidden",
      "This social authorization request has expired.",
    );
  }

  if (!oauthState.connectionId) {
    throw new ServiceError(
      "conflict",
      "The social authorization request is missing its connection.",
    );
  }

  const keyVersion =
    readKeyVersion(
      oauthState.metadata,
    );

  const codeVerifier =
    decryptSocialValue({
      ciphertext:
        oauthState.codeVerifierCiphertext,
      iv: oauthState.codeVerifierIv,
      authTag:
        oauthState.codeVerifierAuthTag,
      keyVersion,
    });

  return {
    oauthStateId:
      oauthState.id,
    clientId:
      oauthState.clientId,
    businessBrandId:
      oauthState.businessBrandId,
    connectionId:
      oauthState.connectionId,
    codeVerifier,
    returnPath:
      oauthState.returnPath,
  };
}

export async function completeSocialOAuthState(options: {
  oauthStateId: string;
  connectionId: string;
  externalSubjectId?: string | null;
  displayName?: string | null;
  scopes?: string[];
  tokenPayload: SocialTokenPayload;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
}): Promise<void> {
  const prisma = requirePrisma();

  const encrypted =
    encryptSocialTokenPayload(
      options.tokenPayload,
    );

  await prisma.$transaction(
    async (transaction) => {
      const oauthState =
        await transaction.socialOAuthState.findFirst({
          where: {
            id: options.oauthStateId,
            connectionId:
              options.connectionId,
            status: "pending",
          },
          select: {
            id: true,
            clientId: true,
          },
        });

      if (!oauthState) {
        throw new ServiceError(
          "conflict",
          "The social authorization request cannot be completed.",
        );
      }

      await transaction.socialCredential.upsert({
        where: {
          connectionId:
            options.connectionId,
        },
        update: {
          clientId:
            oauthState.clientId,
          encryptedPayload:
            encrypted.ciphertext,
          iv: encrypted.iv,
          authTag:
            encrypted.authTag,
          keyVersion:
            encrypted.keyVersion,
          tokenExpiresAt:
            options.accessTokenExpiresAt ??
            null,
          refreshExpiresAt:
            options.refreshTokenExpiresAt ??
            null,
        },
        create: {
          clientId:
            oauthState.clientId,
          connectionId:
            options.connectionId,
          encryptedPayload:
            encrypted.ciphertext,
          iv: encrypted.iv,
          authTag:
            encrypted.authTag,
          keyVersion:
            encrypted.keyVersion,
          tokenExpiresAt:
            options.accessTokenExpiresAt ??
            null,
          refreshExpiresAt:
            options.refreshTokenExpiresAt ??
            null,
        },
      });

      await transaction.socialProviderConnection.update({
        where: {
          id: options.connectionId,
        },
        data: {
          status: "authorized",
          externalSubjectId:
            options.externalSubjectId ??
            null,
          displayName:
            options.displayName ??
            null,
          scopes:
            options.scopes ?? [],
          accessTokenExpiresAt:
            options.accessTokenExpiresAt ??
            null,
          refreshTokenExpiresAt:
            options.refreshTokenExpiresAt ??
            null,
          lastValidatedAt:
            new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await transaction.socialOAuthState.update({
        where: {
          id: oauthState.id,
        },
        data: {
          status: "completed",
          consumedAt:
            new Date(),
        },
      });
    },
  );
}

export async function failSocialOAuthState(options: {
  oauthStateId: string;
  connectionId?: string | null;
  message: string;
}): Promise<void> {
  const prisma = requirePrisma();

  await prisma.$transaction(
    async (transaction) => {
      await transaction.socialOAuthState.updateMany({
        where: {
          id: options.oauthStateId,
          status: "pending",
        },
        data: {
          status: "failed",
          errorMessage:
            options.message.slice(
              0,
              500,
            ),
          consumedAt:
            new Date(),
        },
      });

      if (options.connectionId) {
        await transaction.socialProviderConnection.updateMany({
          where: {
            id: options.connectionId,
          },
          data: {
            status: "error",
            lastErrorCode:
              "oauth_failed",
            lastErrorMessage:
              options.message.slice(
                0,
                500,
              ),
          },
        });
      }
    },
  );
}
