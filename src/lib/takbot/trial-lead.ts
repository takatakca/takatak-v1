// A TAK-TAK trial sign-up becomes one card in the TAKATAK agency CRM
// (/dashboard/leads, source "takatak.ca TAK bot trial": the bot's earlier name,
// kept because it is the lookup key of existing cards), so the team sees who
// started and can help. One card per address; never a marketing consent:
// newsletter and device alerts keep their own opt-in.

import type { Prisma } from "@prisma/client";

export const TRIAL_LEAD_SOURCE = "takatak.ca TAK bot trial";

type Tx = Pick<Prisma.TransactionClient, "leadSource" | "lead" | "auditLog" | "$executeRaw">;

export interface TrialLeadDb {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface TrialLeadInput {
  /** The agency workspace that owns website leads (WEBSITE_LEADS_CLIENT_ID). */
  agencyClientId: string;
  /** The visitor's own workspace, where the trial credits live. */
  workspaceClientId: string;
  /** From the profile row (never from client-sent data). */
  email: string;
  name: string | null;
  language: "fr" | "en";
  sourcePage: string | null;
  credits: number;
  now?: Date;
}

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;

async function sourceId(tx: Tx, clientId: string): Promise<string> {
  const found = await tx.leadSource.findFirst({ where: { clientId, name: TRIAL_LEAD_SOURCE }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.leadSource.create({
    data: {
      clientId,
      name: TRIAL_LEAD_SOURCE,
      type: "website_form",
      provider: "manual",
      status: "active_internal",
      metadata: { note: "Visitors who signed in on takatak.ca to try TAK-TAK with trial credits." },
    },
    select: { id: true },
  });
  return created.id;
}

/** Creates or refreshes the visitor's CRM card. Returns null for an unusable address. */
export async function recordTrialLead(db: TrialLeadDb, input: TrialLeadInput): Promise<{ id: string; created: boolean } | null> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return null;
  const now = input.now ?? new Date();
  const name = input.name?.replace(/\s+/g, " ").trim().slice(0, 120) || null;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`takbot-trial:${input.agencyClientId}:${email}`}))`;
    const leadSourceId = await sourceId(tx, input.agencyClientId);
    const existing = await tx.lead.findFirst({
      where: { clientId: input.agencyClientId, leadSourceId, email },
      select: { id: true, metadata: true },
    });
    const trial = {
      workspaceClientId: input.workspaceClientId,
      credits: input.credits,
      startedAt: now.toISOString(),
      sourcePage: input.sourcePage,
      signIn: "supabase_auth",
    };
    if (existing) {
      const base = existing.metadata && typeof existing.metadata === "object" ? (existing.metadata as Record<string, unknown>) : {};
      await tx.lead.update({
        where: { id: existing.id },
        data: { metadata: { ...base, lastSeenAt: now.toISOString() } as Prisma.InputJsonValue },
      });
      return { id: existing.id, created: false };
    }
    const lead = await tx.lead.create({
      data: {
        clientId: input.agencyClientId,
        leadSourceId,
        name,
        email,
        message: `TAK-TAK trial · ${input.credits} credits · ${input.language.toUpperCase()}`,
        status: "new_internal",
        priority: "normal",
        currency: "CAD",
        metadata: { origin: "takbot_trial", language: input.language, trial, marketingConsent: false } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: { clientId: input.agencyClientId, action: "takbot_trial_lead_recorded", entityType: "Lead", entityId: lead.id, metadata: { credits: input.credits } },
    });
    return { id: lead.id, created: true };
  });
}
