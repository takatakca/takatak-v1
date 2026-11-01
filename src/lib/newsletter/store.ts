// Newsletter subscribers are stored as Leads of the "takatak.ca newsletter"
// source in the TAKATAK agency workspace (no new table, visible in
// /dashboard/leads). The consent history lives in the lead's metadata as proof.

import type { Prisma } from "@prisma/client";

import {
  confirmLinkValid,
  confirmed,
  readState,
  unsubscribed,
  withConsent,
  type ConsentProof,
  type NewsletterSignup,
  type NewsletterState,
  type SubscriptionStatus,
} from "./consent";

export const NEWSLETTER_SOURCE_NAME = "takatak.ca newsletter";
export const SIGNUP_FLOOD_WINDOW_MS = 10 * 60 * 1000;
export const SIGNUP_FLOOD_LIMIT = 60;
/** No second confirmation email to the same address within this window. */
export const RESEND_WINDOW_MS = 10 * 60 * 1000;

export class NewsletterRateLimitedError extends Error {
  constructor() {
    super("Newsletter sign-ups are temporarily rate limited.");
    this.name = "NewsletterRateLimitedError";
  }
}

type Tx = Pick<Prisma.TransactionClient, "leadSource" | "lead" | "auditLog" | "$executeRaw">;

export interface NewsletterDb {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

function summary(state: NewsletterState, language: string): string {
  const label = { pending: "pending confirmation", confirmed: "confirmed", unsubscribed: "unsubscribed" }[state.status];
  return `Newsletter subscriber · ${label} · ${language.toUpperCase()} · ${state.topics.join(", ")}`;
}

function metadataWith(previous: unknown, state: NewsletterState, language: string): Prisma.InputJsonValue {
  const base = previous && typeof previous === "object" ? (previous as Record<string, unknown>) : {};
  return { ...base, origin: "takatak_newsletter", language, newsletter: state } as unknown as Prisma.InputJsonValue;
}

async function sourceId(tx: Tx, clientId: string): Promise<string> {
  const found = await tx.leadSource.findFirst({
    where: { clientId, type: "email", name: NEWSLETTER_SOURCE_NAME },
    select: { id: true },
  });
  if (found) return found.id;
  const created = await tx.leadSource.create({
    data: {
      clientId,
      name: NEWSLETTER_SOURCE_NAME,
      type: "email",
      provider: "manual",
      status: "active_internal",
      metadata: { note: "takatak.ca newsletter sign-ups (CASL express consent, double opt-in)." },
    },
    select: { id: true },
  });
  return created.id;
}

export interface RecordedSignup {
  id: string;
  status: SubscriptionStatus;
  /** False when already confirmed, or a confirmation was sent a moment ago. */
  sendConfirmation: boolean;
  /** givenAt of the consent a confirmation email would confirm. */
  stamp: string;
}

export async function recordSignup(
  db: NewsletterDb,
  input: { clientId: string; signup: NewsletterSignup; proof: ConsentProof; now?: Date },
): Promise<RecordedSignup> {
  const now = input.now ?? new Date();
  const { clientId, signup, proof } = input;

  return db.$transaction(async (tx) => {
    // One sign-up at a time per address (two tabs or a double click must not create two records).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`newsletter:${clientId}:${signup.email}`}))`;
    const leadSourceId = await sourceId(tx, clientId);

    const existing = await tx.lead.findFirst({
      where: { clientId, leadSourceId, email: signup.email },
      select: { id: true, metadata: true },
    });

    if (!existing) {
      const recent = await tx.lead.count({
        where: { clientId, leadSourceId, createdAt: { gte: new Date(now.getTime() - SIGNUP_FLOOD_WINDOW_MS) } },
      });
      if (recent >= SIGNUP_FLOOD_LIMIT) throw new NewsletterRateLimitedError();
    }

    const prev = existing ? readState(existing.metadata) : null;
    const lastConsent = prev?.consents.at(-1)?.givenAt;
    const recentlyAsked =
      prev?.status === "pending" && lastConsent && now.getTime() - Date.parse(lastConsent) < RESEND_WINDOW_MS;
    // A repeat inside the window changes nothing (no new proof, no new email).
    if (existing && prev && recentlyAsked) {
      return { id: existing.id, status: prev.status, sendConfirmation: false, stamp: lastConsent ?? "" };
    }

    const state = withConsent(prev, proof, signup.topics);
    const data = {
      message: summary(state, signup.language),
      status: "new_internal" as const,
      priority: "low" as const,
      metadata: metadataWith(existing?.metadata, state, signup.language),
    };

    const lead = existing
      ? await tx.lead.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.lead.create({
          data: { clientId, leadSourceId, email: signup.email, currency: "CAD", ...data },
          select: { id: true },
        });

    await tx.auditLog.create({
      data: {
        clientId,
        action: "newsletter_consent_recorded",
        entityType: "Lead",
        entityId: lead.id,
        metadata: { version: proof.version, language: proof.language, sourcePage: proof.sourcePage },
      },
    });

    return { id: lead.id, status: state.status, sendConfirmation: state.status === "pending", stamp: proof.givenAt };
  });
}

/** Applies a confirm or unsubscribe link. Null when the record does not exist. */
export async function applyLink(
  db: NewsletterDb,
  input: { clientId: string; id: string; action: "confirm" | "unsubscribe"; stamp?: string; now?: Date },
): Promise<SubscriptionStatus | "expired_link" | null> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: input.id, clientId: input.clientId, leadSource: { name: NEWSLETTER_SOURCE_NAME } },
      select: { id: true, metadata: true },
    });
    const prev = lead ? readState(lead.metadata) : null;
    if (!lead || !prev) return null;
    // A confirm link only confirms the sign-up it was sent for, within its validity.
    if (input.action === "confirm" && prev.status === "pending" && !confirmLinkValid(prev, input.stamp ?? "", now)) {
      return "expired_link";
    }

    const next = input.action === "confirm" ? confirmed(prev, now) : unsubscribed(prev, now);
    if (next.status === prev.status) return next.status;

    const language =
      (lead.metadata as Record<string, unknown> | null)?.language === "en" ? "en" : "fr";
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        message: summary(next, language),
        status: next.status === "unsubscribed" ? "archived" : "new_internal",
        metadata: metadataWith(lead.metadata, next, language),
      },
    });
    await tx.auditLog.create({
      data: {
        clientId: input.clientId,
        action: next.status === "confirmed" ? "newsletter_confirmed" : "newsletter_unsubscribed",
        entityType: "Lead",
        entityId: lead.id,
      },
    });
    return next.status;
  });
}
