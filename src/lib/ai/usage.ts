// TK-069 — Credit usage and estimated cost for one workspace.
// Reads AiCreditAccount and AiCreditEntry. Does not debit or grant.

import { getPrisma } from "@/lib/db/prisma";
import { AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, type CreditActionDef } from "@/lib/growth/ai-engine";
import { resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";

/** Published Starter pack: 15 CAD for 100 credits. */
export const STARTER_CENTS_PER_CREDIT = 15;

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function creditsSpent(entries: Array<{ delta: number; createdAt: Date }>, since: Date): number {
  let spent = 0;
  for (const entry of entries) {
    if (entry.delta < 0 && entry.createdAt >= since) spent += -entry.delta;
  }
  return spent;
}

export function estimateCadCents(credits: number): number {
  if (!Number.isInteger(credits) || credits < 0) return 0;
  return credits * STARTER_CENTS_PER_CREDIT;
}

export function formatCad(cents: number): string {
  const safe = Number.isInteger(cents) && cents >= 0 ? cents : 0;
  return `${(safe / 100).toFixed(2)} $ CA`;
}

export interface UsageEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  actionKey: string | null;
  note: string | null;
  createdAt: string;
}

export interface UsageView {
  source: "database" | "selection_required" | "unavailable";
  label: string;
  balance: number | null;
  spentThisMonth: number | null;
  estimatedCadCents: number | null;
  entries: UsageEntry[];
  actions: CreditActionDef[];
}

const REASON_LABELS: Record<string, string> = {
  purchase: "Achat",
  grant: "Octroi",
  debit: "Débit",
  refund: "Remboursement",
  adjustment: "Ajustement",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function actionLabel(actionKey: string | null, actions: CreditActionDef[] = AI_CREDIT_ACTIONS): string {
  if (!actionKey) return "—";
  return actions.find((action) => action.key === actionKey)?.label ?? actionKey;
}

function empty(source: UsageView["source"], label: string): UsageView {
  return {
    source,
    label,
    balance: null,
    spentThisMonth: null,
    estimatedCadCents: null,
    entries: [],
    actions: AI_CREDIT_ACTIONS,
  };
}

export async function getAiUsageData(access?: TenantAccess): Promise<UsageView> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable" || scope.kind === "mock") {
    return empty("unavailable", scope.label);
  }
  if (!scope.clientIds || scope.clientIds.length !== 1) {
    return empty("selection_required", "Sélectionnez un espace client pour voir son solde.");
  }
  const prisma = getPrisma();
  if (!prisma) return empty("unavailable", "Data is temporarily unavailable.");
  const clientId = scope.clientIds[0];
  const since = monthStartUtc(new Date());
  try {
    const [account, spent, entries] = await Promise.all([
      prisma.aiCreditAccount.findUnique({ where: { clientId }, select: { balance: true } }),
      prisma.aiCreditEntry.aggregate({
        where: { clientId, createdAt: { gte: since }, delta: { lt: 0 } },
        _sum: { delta: true },
      }),
      prisma.aiCreditEntry.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          delta: true,
          balanceAfter: true,
          reason: true,
          actionKey: true,
          note: true,
          createdAt: true,
        },
      }),
    ]);
    const spentThisMonth = Math.abs(spent._sum.delta ?? 0);
    return {
      source: "database",
      label: scope.label,
      balance: account?.balance ?? 0,
      spentThisMonth,
      estimatedCadCents: estimateCadCents(spentThisMonth),
      entries: entries.map((entry) => ({
        id: entry.id,
        delta: entry.delta,
        balanceAfter: entry.balanceAfter,
        reason: entry.reason,
        actionKey: entry.actionKey,
        note: entry.note,
        createdAt: entry.createdAt.toISOString().slice(0, 10),
      })),
      actions: AI_CREDIT_ACTIONS,
    };
  } catch {
    console.error("[ai-usage] credit read failed");
    return empty("unavailable", "Data is temporarily unavailable.");
  }
}

export function starterPackRateLabel(): string {
  const starter = AI_CREDIT_PACKS.find((pack) => pack.key === "starter");
  if (!starter) return "Forfait Starter";
  return `${starter.priceCad} $ CA / ${starter.credits} crédits`;
}
