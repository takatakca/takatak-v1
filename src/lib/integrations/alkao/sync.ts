import "server-only";

import { getPrisma } from "@/lib/db/prisma";

import { fetchAlkaoState, sendAlkaoEvents, type AlkaoTarget, type SendOutcome } from "./client";
import { planAlkaoSync, type AlkaoSyncSettings, type PlannedEvent, type TakatakClient } from "./plan";

/**
 * TAKATAK → ALKAO synchronization. It READS the TAKATAK database (never writes) and sends
 * only the differences to ALKAO. It is off unless ALKAO_SYNC_URL, ALKAO_CONTROL_KEY_ID,
 * ALKAO_CONTROL_SECRET and ALKAO_TICKETING_CLIENT_IDS are set.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseIdList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => UUID.test(id)),
  );
}

export interface AlkaoSyncConfig {
  target: AlkaoTarget;
  settings: AlkaoSyncSettings;
}

export function loadAlkaoSyncConfig(env: NodeJS.ProcessEnv = process.env): AlkaoSyncConfig | null {
  const url = env.ALKAO_SYNC_URL?.trim();
  const keyId = env.ALKAO_CONTROL_KEY_ID?.trim();
  const secret = env.ALKAO_CONTROL_SECRET?.trim();
  const clientIds = parseIdList(env.ALKAO_TICKETING_CLIENT_IDS);
  if (!url || !keyId || !secret || secret.length < 32 || clientIds.size === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const local = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname) && env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !local) return null;
  const rate = Number(env.ALKAO_COMMISSION_RATE_BPS);
  const fixed = Number(env.ALKAO_COMMISSION_FIXED_CENTS);
  const defaultCommission =
    Number.isInteger(rate) && rate >= 0 && rate <= 10_000 && Number.isInteger(fixed) && fixed >= 0 && fixed <= 100_000 &&
    env.ALKAO_COMMISSION_RATE_BPS !== undefined && env.ALKAO_COMMISSION_FIXED_CENTS !== undefined
      ? { rateBps: rate, fixedCentsPerPaidAdmission: fixed }
      : null;
  return {
    target: { url: parsed.origin, keyId, secret },
    settings: { clientIds, ticketingBrandIds: parseIdList(env.ALKAO_TICKETING_BRAND_IDS), defaultCommission },
  };
}

/** Read-only: the master records of the listed Clients. */
export async function readTakatakMaster(clientIds: ReadonlySet<string>): Promise<TakatakClient[]> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database is not configured.");
  const clients = await prisma.client.findMany({
    where: { id: { in: [...clientIds] } },
    select: {
      id: true,
      name: true,
      status: true,
      timezone: true,
      businessBrands: { select: { id: true, name: true, status: true } },
      memberships: { select: { role: true, status: true, profile: { select: { authUserId: true, status: true } } } },
    },
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    timezone: c.timezone,
    brands: c.businessBrands.map((b) => ({ id: b.id, name: b.name, status: b.status })),
    members: c.memberships.map((m) => ({ authUserId: m.profile.authUserId, role: m.role, status: m.status, profileStatus: m.profile.status })),
  }));
}

export interface AlkaoSyncResult {
  dryRun: boolean;
  planned: Pick<PlannedEvent, "type" | "label">[];
  sent: SendOutcome[];
  warnings: string[];
  ok: boolean;
}

export async function runAlkaoSync(config: AlkaoSyncConfig, options: { dryRun: boolean }): Promise<AlkaoSyncResult> {
  const [master, alkao] = await Promise.all([readTakatakMaster(config.settings.clientIds), fetchAlkaoState(config.target)]);
  const plan = planAlkaoSync(master, alkao, config.settings, Date.now());
  const planned = plan.events.map(({ type, label }) => ({ type, label }));
  if (options.dryRun || plan.events.length === 0) {
    return { dryRun: options.dryRun, planned, sent: [], warnings: plan.warnings, ok: true };
  }
  const sent = await sendAlkaoEvents(config.target, plan.events);
  return { dryRun: false, planned, sent, warnings: plan.warnings, ok: sent.length === plan.events.length && sent.every((s) => s.status === 200) };
}
