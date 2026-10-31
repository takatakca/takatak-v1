// Push subscriptions are kept as Leads of the "takatak.ca push alerts" source
// (no new table). The endpoint is stored in metadata and looked up by hash;
// the consent history stays as proof after a stop.

import type { Prisma } from "@prisma/client";

import {
  endpointHash,
  pushStopped,
  pushWithConsent,
  readPushState,
  type PushConsentProof,
  type PushState,
  type PushSubscriptionInput,
} from "./subscription";

export const PUSH_SOURCE_NAME = "takatak.ca push alerts";
export const PUSH_FLOOD_WINDOW_MS = 10 * 60 * 1000;
export const PUSH_FLOOD_LIMIT = 60;

export class PushRateLimitedError extends Error {
  constructor() {
    super("Push sign-ups are temporarily rate limited.");
    this.name = "PushRateLimitedError";
  }
}

type Tx = Pick<Prisma.TransactionClient, "leadSource" | "lead" | "auditLog" | "$executeRaw">;

export interface PushDb {
  $transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

function metadataWith(previous: unknown, state: PushState, language: string): Prisma.InputJsonValue {
  const base = previous && typeof previous === "object" ? (previous as Record<string, unknown>) : {};
  return { ...base, origin: "takatak_push", language, push: state } as unknown as Prisma.InputJsonValue;
}

function summary(state: PushState, language: string): string {
  return `Push deal alerts · browser · ${state.status} · ${language.toUpperCase()}`;
}

async function sourceId(tx: Tx, clientId: string): Promise<string> {
  const found = await tx.leadSource.findFirst({ where: { clientId, name: PUSH_SOURCE_NAME }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.leadSource.create({
    data: {
      clientId,
      name: PUSH_SOURCE_NAME,
      type: "website_form",
      provider: "manual",
      status: "active_internal",
      metadata: { note: "Browser push deal alerts (own prompt, then browser permission)." },
    },
    select: { id: true },
  });
  return created.id;
}

function byHash(clientId: string, leadSourceId: string, hash: string): Prisma.LeadWhereInput {
  return { clientId, leadSourceId, metadata: { path: ["push", "endpointHash"], equals: hash } };
}

export async function recordPushSubscription(
  db: PushDb,
  input: { clientId: string; sub: PushSubscriptionInput; proof: PushConsentProof; now?: Date },
): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const hash = endpointHash(input.sub.endpoint);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`push:${input.clientId}:${hash}`}))`;
    const leadSourceId = await sourceId(tx, input.clientId);
    const existing = await tx.lead.findFirst({ where: byHash(input.clientId, leadSourceId, hash), select: { id: true, metadata: true } });
    if (!existing) {
      const recent = await tx.lead.count({
        where: { clientId: input.clientId, leadSourceId, createdAt: { gte: new Date(now.getTime() - PUSH_FLOOD_WINDOW_MS) } },
      });
      if (recent >= PUSH_FLOOD_LIMIT) throw new PushRateLimitedError();
    }
    const state = pushWithConsent(existing ? readPushState(existing.metadata) : null, input.sub, input.proof);
    const data = {
      name: "Push alerts (browser)",
      message: summary(state, input.sub.language),
      status: "new_internal" as const,
      priority: "low" as const,
      metadata: metadataWith(existing?.metadata, state, input.sub.language),
    };
    const lead = existing
      ? await tx.lead.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.lead.create({ data: { clientId: input.clientId, leadSourceId, currency: "CAD", ...data }, select: { id: true } });
    await tx.auditLog.create({
      data: { clientId: input.clientId, action: "push_consent_recorded", entityType: "Lead", entityId: lead.id, metadata: { version: input.proof.version } },
    });
    return { id: lead.id };
  });
}

/** Stops alerts for an endpoint. Knowing the endpoint is the credential (only that browser has it). */
export async function stopPushSubscription(
  db: PushDb,
  input: { clientId: string; endpoint: string; by: "person" | "push_service"; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const hash = endpointHash(input.endpoint);
  return db.$transaction(async (tx) => {
    const source = await tx.leadSource.findFirst({ where: { clientId: input.clientId, name: PUSH_SOURCE_NAME }, select: { id: true } });
    if (!source) return false;
    const lead = await tx.lead.findFirst({ where: byHash(input.clientId, source.id, hash), select: { id: true, metadata: true } });
    const prev = lead ? readPushState(lead.metadata) : null;
    if (!lead || !prev || prev.endpoint !== input.endpoint) return false;
    if (prev.status === "stopped") return true;
    const next = pushStopped(prev, input.by, now);
    const language = (lead.metadata as Record<string, unknown> | null)?.language === "en" ? "en" : "fr";
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "archived", message: summary(next, language), metadata: metadataWith(lead.metadata, next, language) },
    });
    await tx.auditLog.create({
      data: { clientId: input.clientId, action: "push_stopped", entityType: "Lead", entityId: lead.id, metadata: { by: input.by } },
    });
    return true;
  });
}

/** Active subscriptions, for a send. */
export async function activePushTargets(db: PushDb, clientId: string): Promise<Array<{ id: string; endpoint: string }>> {
  return db.$transaction(async (tx) => {
    const source = await tx.leadSource.findFirst({ where: { clientId, name: PUSH_SOURCE_NAME }, select: { id: true } });
    if (!source) return [];
    const rows = await tx.lead.findMany({
      where: { clientId, leadSourceId: source.id, status: { not: "archived" } },
      select: { id: true, metadata: true },
      take: 5000,
    });
    return rows.flatMap((r) => {
      const state = readPushState(r.metadata);
      return state?.status === "active" ? [{ id: r.id, endpoint: state.endpoint }] : [];
    });
  });
}
