import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { RuntimeLock } from "@atproto/oauth-client-node";

import { getPrisma } from "@/lib/db/prisma";

const BLUESKY_LOCK_NAMESPACE =
  "takatak:bluesky-oauth:v1";

const BLUESKY_LOCK_TIMEOUT_MS = 120_000;

function advisoryLockKey(name: string): bigint {
  const digest = createHash("sha256")
    .update(BLUESKY_LOCK_NAMESPACE)
    .update("\0")
    .update(name)
    .digest();

  return digest.readBigInt64BE(0);
}

/**
 * Serializes ATProto credential mutations across every application instance.
 *
 * The transaction owns a PostgreSQL transaction-level advisory lock. PostgreSQL
 * releases it automatically on success, failure, timeout, or connection loss.
 */
export const requestBlueskyOAuthLock: RuntimeLock =
  async (name, operation) => {
    const database = getPrisma();

    if (!database) {
      throw new Error(
        "Database access is required for the Bluesky OAuth lock.",
      );
    }

    const lockKey = advisoryLockKey(name);

    return database.$transaction(
      async (
        transaction: Prisma.TransactionClient,
      ) => {
        await transaction.$queryRaw<
          Array<{ locked: boolean }>
        >`
          SELECT (
            pg_advisory_xact_lock(
              ${lockKey}
            ) IS NULL
          ) AS locked
        `;

        return operation();
      },
      {
        maxWait: 15_000,
        timeout: BLUESKY_LOCK_TIMEOUT_MS,
      },
    );
  };
