import "server-only";

// AI credit ledger. The balance row is the single source of truth and every
// change writes one append-only entry with a globally unique idempotency key,
// so a retried gateway call can never double-charge or double-grant.

import { Prisma, type PrismaClient } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { AI_CREDIT_ACTIONS } from "@/lib/growth/ai-engine";

export const MAX_UNITS_PER_DEBIT = 100;
export const MAX_GRANT = 1_000_000;

type Tx = Prisma.TransactionClient;

function requirePrisma(): PrismaClient {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

export function creditCostFor(actionKey: string, units: number): number | null {
  const action = AI_CREDIT_ACTIONS.find((a) => a.key === actionKey);
  if (!action || !Number.isInteger(units) || units < 1 || units > MAX_UNITS_PER_DEBIT) return null;
  return action.credits * units;
}

export function isValidIdempotencyKey(key: string): boolean {
  return /^[A-Za-z0-9:_.-]{8,128}$/.test(key);
}

export interface CreditSnapshot {
  balance: number;
  entries: Array<{
    id: string;
    delta: number;
    balanceAfter: number;
    reason: string;
    actionKey: string | null;
    note: string | null;
    createdAt: Date;
  }>;
}

export async function getCreditSnapshot(clientId: string): Promise<CreditSnapshot> {
  const prisma = requirePrisma();
  const [account, entries] = await Promise.all([
    prisma.aiCreditAccount.findUnique({ where: { clientId }, select: { balance: true } }),
    prisma.aiCreditEntry.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, delta: true, balanceAfter: true, reason: true, actionKey: true, note: true, createdAt: true },
    }),
  ]);
  return { balance: account?.balance ?? 0, entries };
}

export type LedgerResult =
  | { ok: true; entryId: string; balance: number; delta: number; replayed: boolean }
  | { ok: false; code: "insufficient_credits" | "unknown_client" | "idempotency_conflict" | "invalid_request"; balance?: number };

async function replay(tx: Tx | PrismaClient, key: string, clientId: string, expectedDelta: number): Promise<LedgerResult | null> {
  const existing = await tx.aiCreditEntry.findUnique({
    where: { idempotencyKey: key },
    select: { id: true, clientId: true, delta: true, balanceAfter: true },
  });
  if (!existing) return null;
  if (existing.clientId !== clientId || existing.delta !== expectedDelta) return { ok: false, code: "idempotency_conflict" };
  const account = await tx.aiCreditAccount.findUnique({ where: { clientId }, select: { balance: true } });
  return { ok: true, entryId: existing.id, balance: account?.balance ?? existing.balanceAfter, delta: existing.delta, replayed: true };
}

async function applyChange(input: {
  clientId: string;
  delta: number;
  reason: "purchase" | "grant" | "debit" | "refund" | "adjustment";
  idempotencyKey: string;
  actionKey?: string | null;
  note?: string | null;
  actorProfileId?: string | null;
}): Promise<LedgerResult> {
  const prisma = requirePrisma();
  if (!Number.isInteger(input.delta) || input.delta === 0 || !isValidIdempotencyKey(input.idempotencyKey)) {
    return { ok: false, code: "invalid_request" };
  }

  const prior = await replay(prisma, input.idempotencyKey, input.clientId, input.delta);
  if (prior) return prior;

  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
  if (!client) return { ok: false, code: "unknown_client" };

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.aiCreditAccount.upsert({ where: { clientId: input.clientId }, create: { clientId: input.clientId }, update: {} });
      const changed = await tx.aiCreditAccount.updateMany({
        where: input.delta < 0 ? { clientId: input.clientId, balance: { gte: -input.delta } } : { clientId: input.clientId },
        data: { balance: { increment: input.delta } },
      });
      const account = await tx.aiCreditAccount.findUniqueOrThrow({ where: { clientId: input.clientId }, select: { balance: true } });
      if (changed.count !== 1) return { ok: false, code: "insufficient_credits", balance: account.balance } as const;
      const entry = await tx.aiCreditEntry.create({
        data: {
          clientId: input.clientId,
          delta: input.delta,
          balanceAfter: account.balance,
          reason: input.reason,
          actionKey: input.actionKey ?? null,
          idempotencyKey: input.idempotencyKey,
          note: input.note ?? null,
          actorProfileId: input.actorProfileId ?? null,
        },
        select: { id: true },
      });
      return { ok: true, entryId: entry.id, balance: account.balance, delta: input.delta, replayed: false } as const;
    });
  } catch (error) {
    // A concurrent call with the same key won the race; its transaction committed, ours rolled back.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return (await replay(prisma, input.idempotencyKey, input.clientId, input.delta)) ?? { ok: false, code: "idempotency_conflict" };
    }
    throw error;
  }
}

export async function debitCredits(input: {
  clientId: string;
  actionKey: string;
  units?: number;
  idempotencyKey: string;
}): Promise<LedgerResult> {
  const cost = creditCostFor(input.actionKey, input.units ?? 1);
  if (cost === null) return { ok: false, code: "invalid_request" };
  return applyChange({
    clientId: input.clientId,
    delta: -cost,
    reason: "debit",
    actionKey: input.actionKey,
    idempotencyKey: `debit:${input.idempotencyKey}`,
  });
}

/** Refunds a previous debit in full, at most once. */
export async function refundDebit(input: { clientId: string; debitIdempotencyKey: string; note?: string | null }): Promise<LedgerResult> {
  const prisma = requirePrisma();
  const original = await prisma.aiCreditEntry.findUnique({
    where: { idempotencyKey: `debit:${input.debitIdempotencyKey}` },
    select: { clientId: true, delta: true, actionKey: true },
  });
  if (!original || original.clientId !== input.clientId || original.delta >= 0) return { ok: false, code: "invalid_request" };
  return applyChange({
    clientId: input.clientId,
    delta: -original.delta,
    reason: "refund",
    actionKey: original.actionKey,
    idempotencyKey: `refund:${input.debitIdempotencyKey}`,
    note: input.note ?? null,
  });
}

export async function grantCredits(input: {
  clientId: string;
  credits: number;
  reason: "purchase" | "grant" | "adjustment";
  idempotencyKey: string;
  note?: string | null;
  actorProfileId?: string | null;
}): Promise<LedgerResult> {
  if (!Number.isInteger(input.credits) || input.credits === 0 || Math.abs(input.credits) > MAX_GRANT) {
    return { ok: false, code: "invalid_request" };
  }
  if (input.credits < 0 && input.reason !== "adjustment") return { ok: false, code: "invalid_request" };
  return applyChange({
    clientId: input.clientId,
    delta: input.credits,
    reason: input.reason,
    idempotencyKey: `${input.reason}:${input.idempotencyKey}`,
    note: input.note ?? null,
    actorProfileId: input.actorProfileId ?? null,
  });
}

export async function listClientBalances(limit = 200): Promise<Array<{ id: string; name: string; balance: number }>> {
  const prisma = requirePrisma();
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, aiCreditAccount: { select: { balance: true } } },
  });
  return clients.map((c) => ({ id: c.id, name: c.name, balance: c.aiCreditAccount?.balance ?? 0 }));
}
