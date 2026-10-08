import "server-only";

import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";

import { getPrisma } from "@/lib/db/prisma";
import {
  decryptSocialValue,
  encryptSocialValue,
} from "@/lib/social/security/social-crypto";

type StoreKind = "state" | "session";

type StoreContext = {
  clientId: string;
  connectionId: string;
};

function requirePrisma() {
  const prisma = getPrisma();

  if (!prisma) {
    throw new Error(
      "The Bluesky OAuth database is unavailable.",
    );
  }

  return prisma;
}

function buildAad(options: {
  clientId: string;
  connectionId: string;
  kind: StoreKind;
  storeKey: string;
}): string {
  return [
    "takatak-bluesky-oauth",
    options.clientId,
    options.connectionId,
    options.kind,
    options.storeKey,
  ].join(":");
}

function createEncryptedStore<T extends object>(
  context: StoreContext,
  kind: StoreKind,
) {
  return {
    async get(storeKey: string): Promise<T | undefined> {
      const prisma = requirePrisma();

      const row =
        await prisma.blueskyOAuthStore.findFirst({
          where: {
            clientId: context.clientId,
            connectionId: context.connectionId,
            kind,
            storeKey,
          },
          select: {
            encryptedPayload: true,
            iv: true,
            authTag: true,
            keyVersion: true,
          },
        });

      if (!row) {
        return undefined;
      }

      const plaintext = decryptSocialValue(
        {
          ciphertext: row.encryptedPayload,
          iv: row.iv,
          authTag: row.authTag,
          keyVersion: row.keyVersion,
        },
        buildAad({
          ...context,
          kind,
          storeKey,
        }),
      );

      const parsed = JSON.parse(plaintext) as unknown;

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error(
          "The encrypted Bluesky OAuth record is invalid.",
        );
      }

      return parsed as T;
    },

    async set(
      storeKey: string,
      value: T,
    ): Promise<void> {
      const prisma = requirePrisma();

      const encrypted = encryptSocialValue(
        JSON.stringify(value),
        undefined,
        buildAad({
          ...context,
          kind,
          storeKey,
        }),
      );

      await prisma.blueskyOAuthStore.upsert({
        where: {
          connectionId_kind_storeKey: {
            connectionId: context.connectionId,
            kind,
            storeKey,
          },
        },
        create: {
          clientId: context.clientId,
          connectionId: context.connectionId,
          kind,
          storeKey,
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
        },
        update: {
          clientId: context.clientId,
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
        },
      });
    },

    async del(storeKey: string): Promise<void> {
      const prisma = requirePrisma();

      await prisma.blueskyOAuthStore.deleteMany({
        where: {
          clientId: context.clientId,
          connectionId: context.connectionId,
          kind,
          storeKey,
        },
      });
    },

    async clear(): Promise<void> {
      const prisma = requirePrisma();

      await prisma.blueskyOAuthStore.deleteMany({
        where: {
          clientId: context.clientId,
          connectionId: context.connectionId,
          kind,
        },
      });
    },
  };
}

export function createBlueskyStateStore(
  context: StoreContext,
): NodeSavedStateStore {
  return createEncryptedStore<NodeSavedState>(
    context,
    "state",
  );
}

export function createBlueskySessionStore(
  context: StoreContext,
): NodeSavedSessionStore {
  return createEncryptedStore<NodeSavedSession>(
    context,
    "session",
  );
}
