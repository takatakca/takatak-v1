import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import {
  ahmvScheduleMaxAgeMinutes,
  filterAhmvScheduleEvents,
  validateAhmvScheduleSnapshot,
  type AhmvScheduleSnapshotInput,
} from "./schedule-contract";

export class AhmvScheduleUnavailableError extends Error {}
export class AhmvScheduleConflictError extends Error {}

function hashSnapshot(input: AhmvScheduleSnapshotInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        status: input.status,
        updatedAt: input.updatedAt,
        sourceUrl: input.sourceUrl,
        events: input.events,
      }),
      "utf8",
    )
    .digest("hex");
}

export async function ingestAhmvScheduleSnapshot(
  input: AhmvScheduleSnapshotInput,
  now = new Date(),
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new AhmvScheduleUnavailableError(
      "AHMV schedule store is not configured.",
    );
  }

  const contentHash = hashSnapshot(input);
  const sourceUpdatedAt = new Date(input.updatedAt);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.ahmvScheduleSnapshot.findUnique({
        where: { tenant: "ahmverdun" },
        select: {
          id: true,
          sourceUpdatedAt: true,
          contentHash: true,
        },
      });

      if (existing) {
        const previous = existing.sourceUpdatedAt.getTime();
        const incoming = sourceUpdatedAt.getTime();

        if (incoming < previous) {
          return {
            applied: false as const,
            duplicate: false as const,
            stale: true as const,
            snapshotId: existing.id,
          };
        }

        if (incoming === previous) {
          if (existing.contentHash === contentHash) {
            return {
              applied: false as const,
              duplicate: true as const,
              stale: false as const,
              snapshotId: existing.id,
            };
          }
          throw new AhmvScheduleConflictError(
            "Same source timestamp arrived with different schedule content.",
          );
        }

        const updated = await tx.ahmvScheduleSnapshot.update({
          where: { id: existing.id },
          data: {
            status: input.status,
            sourceUrl: input.sourceUrl,
            sourceUpdatedAt,
            events: input.events as unknown as Prisma.InputJsonValue,
            eventCount: input.events.length,
            contentHash,
            receivedAt: now,
          },
          select: { id: true },
        });

        return {
          applied: true as const,
          duplicate: false as const,
          stale: false as const,
          snapshotId: updated.id,
        };
      }

      const created = await tx.ahmvScheduleSnapshot.create({
        data: {
          tenant: "ahmverdun",
          status: input.status,
          sourceUrl: input.sourceUrl,
          sourceUpdatedAt,
          events: input.events as unknown as Prisma.InputJsonValue,
          eventCount: input.events.length,
          contentHash,
          receivedAt: now,
        },
        select: { id: true },
      });

      return {
        applied: true as const,
        duplicate: false as const,
        stale: false as const,
        snapshotId: created.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function readAhmvScheduleSnapshot(
  input: { team?: string; teamId?: string; category?: string; date?: string },
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new AhmvScheduleUnavailableError(
      "AHMV schedule store is not configured.",
    );
  }

  const stored = await prisma.ahmvScheduleSnapshot.findUnique({
    where: { tenant: "ahmverdun" },
    select: {
      status: true,
      sourceUrl: true,
      sourceUpdatedAt: true,
      events: true,
    },
  });

  if (!stored) {
    return {
      available: false as const,
      reason: "not_ingested" as const,
    };
  }

  const ageMs = now.getTime() - stored.sourceUpdatedAt.getTime();
  if (
    ageMs < -5 * 60_000 ||
    ageMs > ahmvScheduleMaxAgeMinutes(env) * 60_000
  ) {
    return {
      available: false as const,
      reason: "stale" as const,
      updatedAt: stored.sourceUpdatedAt.toISOString(),
      sourceUrl: stored.sourceUrl,
    };
  }

  const normalized = validateAhmvScheduleSnapshot(
    {
      status: stored.status,
      updatedAt: stored.sourceUpdatedAt.toISOString(),
      sourceUrl: stored.sourceUrl,
      events: stored.events,
    },
    now,
  );

  if (!normalized) {
    return {
      available: false as const,
      reason: "invalid_store" as const,
    };
  }

  const events = filterAhmvScheduleEvents(normalized.events, input);
  return {
    available: true as const,
    status: events.length ? ("active" as const) : ("no_match" as const),
    updatedAt: normalized.updatedAt,
    sourceUrl: normalized.sourceUrl,
    events,
  };
}
