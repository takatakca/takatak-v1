import "server-only";

// AI provider keys — encrypted storage and read-only key checks.
//
// Platform owners/admins save one key per provider. The key is encrypted with
// the Growth Suite key (GROWTH_TOKEN_ENCRYPTION_KEY_V1) and bound to its
// provider as additional data, so a row copied to another provider fails to
// decrypt. Only the last four characters are kept in clear. A key is never
// returned to a page, logged, or written to the audit log.

import Anthropic from "@anthropic-ai/sdk";

import { getPrisma } from "@/lib/db/prisma";
import {
  decryptGrowthValue,
  encryptGrowthValue,
  growthEncryptionConfigured,
} from "@/lib/integrations/google-business/crypto";
import { ServiceError } from "@/lib/services/service-error";

import {
  AI_PROVIDER_CATALOG,
  buildCheckRequest,
  keyHint,
  normalizeApiKey,
  outcomeForStatus,
  providerEntry,
  type AiProviderEntry,
  type CheckOutcome,
} from "./catalog";

export const CHECK_TIMEOUT_MS = 10_000;

export type ProviderKeyState =
  | "not_configured"
  | "env_only"
  | "saved_untested"
  | "verified"
  | "check_failed"
  | "no_automatic_check";

export interface ProviderKeyView {
  key: string;
  name: string;
  category: AiProviderEntry["category"];
  billableToClients: boolean;
  note: string | null;
  env: string;
  state: ProviderKeyState;
  keyHint: string | null;
  lastCheckedAt: string | null;
  lastCheckOutcome: CheckOutcome | null;
  checkable: boolean;
  noCheckReason: string | null;
}

export function providerAad(provider: string): string {
  return ["takatak-ai-provider", provider].join(":");
}

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "The database is not available.");
  return prisma;
}

function requireEntry(provider: string): AiProviderEntry {
  const entry = providerEntry(provider);
  if (!entry) throw new ServiceError("invalid_input", "Unknown AI provider.");
  return entry;
}

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function viewState(entry: AiProviderEntry, row: { lastCheckOutcome: string | null } | null): ProviderKeyState {
  if (!row) return hasEnv(entry.env) ? "env_only" : "not_configured";
  if (entry.check.kind === "none") return "no_automatic_check";
  if (row.lastCheckOutcome === "verified") return "verified";
  if (row.lastCheckOutcome) return "check_failed";
  return "saved_untested";
}

export async function listProviderKeys(): Promise<ProviderKeyView[]> {
  const prisma = requirePrisma();
  const rows = await prisma.aiProviderCredential.findMany({
    select: { provider: true, keyHint: true, lastCheckedAt: true, lastCheckOutcome: true },
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return AI_PROVIDER_CATALOG.map((entry) => {
    const row = byProvider.get(entry.key) ?? null;
    return {
      key: entry.key,
      name: entry.name,
      category: entry.category,
      billableToClients: entry.billableToClients,
      note: entry.note ?? null,
      env: entry.env,
      state: viewState(entry, row),
      keyHint: row?.keyHint ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastCheckOutcome: (row?.lastCheckOutcome as CheckOutcome | null) ?? null,
      checkable: entry.check.kind !== "none",
      noCheckReason: entry.check.kind === "none" ? entry.check.reason : null,
    };
  });
}

export function providerKeysStorageReady(): boolean {
  return growthEncryptionConfigured();
}

/** Saves (or replaces) a provider key. The previous check result is cleared. */
export async function saveProviderKey(input: { provider: string; apiKey: unknown; actorProfileId: string }): Promise<void> {
  const entry = requireEntry(input.provider);
  const normalized = normalizeApiKey(input.apiKey);
  if (!normalized.ok) throw new ServiceError("invalid_input", normalized.message);
  if (!growthEncryptionConfigured()) {
    throw new ServiceError("unavailable", "Key storage is not set up on this server (GROWTH_TOKEN_ENCRYPTION_KEY_V1).");
  }

  const encrypted = encryptGrowthValue(normalized.key, providerAad(entry.key));
  const hint = keyHint(normalized.key);
  const prisma = requirePrisma();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.aiProviderCredential.findUnique({ where: { provider: entry.key }, select: { id: true } });
    const data = {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      keyHint: hint,
      lastCheckedAt: null,
      lastCheckOutcome: null,
      updatedByProfileId: input.actorProfileId,
    };
    const row = existing
      ? await tx.aiProviderCredential.update({ where: { provider: entry.key }, data })
      : await tx.aiProviderCredential.create({ data: { ...data, provider: entry.key, createdByProfileId: input.actorProfileId } });

    await tx.auditLog.create({
      data: {
        profileId: input.actorProfileId,
        action: existing ? "ai_provider_key.replaced" : "ai_provider_key.saved",
        entityType: "ai_provider_credential",
        entityId: row.id,
        metadata: { provider: entry.key, keyHint: hint },
      },
    });
  });
}

export async function removeProviderKey(input: { provider: string; actorProfileId: string }): Promise<boolean> {
  const entry = requireEntry(input.provider);
  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.aiProviderCredential.findUnique({ where: { provider: entry.key }, select: { id: true, keyHint: true } });
    if (!existing) return false;
    await tx.aiProviderCredential.delete({ where: { provider: entry.key } });
    await tx.auditLog.create({
      data: {
        profileId: input.actorProfileId,
        action: "ai_provider_key.removed",
        entityType: "ai_provider_credential",
        entityId: existing.id,
        metadata: { provider: entry.key, keyHint: existing.keyHint },
      },
    });
    return true;
  });
}

/**
 * The key to use for a provider, server side only: the saved key first, then
 * the provider's environment variable. Null when neither exists.
 */
export async function resolveProviderKey(provider: string): Promise<string | null> {
  const entry = requireEntry(provider);
  const prisma = requirePrisma();
  const row = await prisma.aiProviderCredential.findUnique({ where: { provider: entry.key } });
  if (row) {
    return decryptGrowthValue(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion },
      providerAad(entry.key),
    );
  }
  return process.env[entry.env]?.trim() || null;
}

export type CheckFetch = (url: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number }>;

/** Runs the provider's read-only check. Never throws for provider failures. */
export async function runKeyCheck(entry: AiProviderEntry, apiKey: string, fetchImpl: CheckFetch = fetch): Promise<CheckOutcome> {
  if (entry.check.kind === "anthropic_sdk") {
    const client = new Anthropic({
      apiKey,
      maxRetries: 0,
      timeout: CHECK_TIMEOUT_MS,
      fetch: fetchImpl as unknown as typeof fetch,
    });
    try {
      await client.models.list({ limit: 1 });
      return "verified";
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionError) return "network_error";
      if (error instanceof Anthropic.APIError && typeof error.status === "number") return outcomeForStatus(error.status);
      return "provider_error";
    }
  }

  const request = buildCheckRequest(entry, apiKey);
  if (!request) throw new ServiceError("invalid_input", "This provider has no automatic key check.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetchImpl(request.url, { method: "GET", headers: request.headers, signal: controller.signal });
    return outcomeForStatus(response.status);
  } catch {
    return "network_error";
  } finally {
    clearTimeout(timer);
  }
}

/** Checks the saved key for a provider and records the outcome. */
export async function checkSavedProviderKey(input: {
  provider: string;
  actorProfileId: string;
  fetchImpl?: CheckFetch;
  now?: Date;
}): Promise<CheckOutcome> {
  const entry = requireEntry(input.provider);
  if (entry.check.kind === "none") throw new ServiceError("invalid_input", entry.check.reason);
  const prisma = requirePrisma();
  const row = await prisma.aiProviderCredential.findUnique({ where: { provider: entry.key } });
  if (!row) throw new ServiceError("not_found", "Save a key for this provider first.");

  const apiKey = decryptGrowthValue(
    { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion },
    providerAad(entry.key),
  );
  const outcome = await runKeyCheck(entry, apiKey, input.fetchImpl);

  // Only record the result if the key was not replaced while the check ran.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.aiProviderCredential.updateMany({
      where: { provider: entry.key, ciphertext: row.ciphertext },
      data: { lastCheckedAt: input.now ?? new Date(), lastCheckOutcome: outcome },
    });
    if (updated.count === 0) return;
    await tx.auditLog.create({
      data: {
        profileId: input.actorProfileId,
        action: "ai_provider_key.checked",
        entityType: "ai_provider_credential",
        entityId: row.id,
        metadata: { provider: entry.key, outcome },
      },
    });
  });

  return outcome;
}
