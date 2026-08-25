import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

/**
 * Interactive social DB transactions stay short: network I/O and
 * encryption preparation happen outside. Default remains Prisma's 5s
 * budget. Selection may pass a higher timeout for multi-row writes on
 * high-latency poolers — never for Meta network I/O inside the TX.
 *
 * Sync claim/finalize must NOT use interactive transactions — use
 * single-statement compare-and-set updates instead (pooler-safe).
 */
export const SOCIAL_DB_TRANSACTION_MAX_WAIT_MS = 5_000;
export const SOCIAL_DB_TRANSACTION_TIMEOUT_MS = 5_000;
/** Page selection persists several scoped rows under pooler latency. */
export const SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS = 15_000;
/** Bounded batch upsert of daily metrics (no Meta I/O inside). */
export const SOCIAL_DB_TRANSACTION_METRIC_BATCH_TIMEOUT_MS = 8_000;
/** Stuck syncing rows older than this may be reclaimed. */
export const SOCIAL_SYNC_STALE_CLAIM_MS = 10 * 60 * 1000;

type PrismaClient = NonNullable<ReturnType<typeof getPrisma>>;

function isTransactionTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error ? String((error as { code?: unknown }).code) : "";

  if (code === "P2028") {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  return /transaction.*timeout|timed out|interactive transaction/i.test(
    message,
  );
}

export function throwSocialTransactionTimeout(
  scope: string,
): never {
  logSocialOAuthEvent(scope, {
    stage: "db_transaction",
    outcome: "timeout",
  });

  throw new ServiceError(
    "unavailable",
    "The social connection update timed out. Nothing was partially saved — you can safely retry.",
    { status: 503 },
  );
}

/**
 * Run a short interactive transaction with concurrency safety.
 * On timeout the transaction is rolled back by Prisma — callers must
 * not perform compensating writes that assume partial success.
 */
export async function runSocialDbTransaction<T>(
  scope: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWaitMs?: number;
    timeoutMs?: number;
  },
): Promise<T> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  try {
    return await (prisma as PrismaClient).$transaction(fn, {
      maxWait:
        options?.maxWaitMs ?? SOCIAL_DB_TRANSACTION_MAX_WAIT_MS,
      timeout:
        options?.timeoutMs ?? SOCIAL_DB_TRANSACTION_TIMEOUT_MS,
    });
  } catch (error) {
    if (isTransactionTimeoutError(error)) {
      throwSocialTransactionTimeout(scope);
    }

    throw error;
  }
}
