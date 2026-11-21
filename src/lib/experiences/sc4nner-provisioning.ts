import "server-only";

import { getPrisma } from "@/lib/db/prisma";

// SC4NNER provider provisioning (owner's order, 2026-11-15).
//
// When an identified TAKATAK account authorizes SC4NNER, two things happen
// on this side, once:
//   1. the provider copy is recorded in the main database (ProviderAccount,
//      source "sc4nner") — identity + email captured once, grouped with
//      every other provider of the ecosystem;
//   2. SC4NNER is told to provision the linked account (POST /api/provision
//      on the SC4NNER deployment, service token, idempotent).
// TAKATAK stays the only identity authority: nothing here creates an
// identity, and no address or verification is required. A failed call to
// SC4NNER never blocks the authorization — the record keeps the outcome
// (provisionStatus) and the exchange still carries the email, which lets
// SC4NNER feed the same link from the exchanged session.

export const SC4NNER_PROVIDER_SOURCE = "sc4nner";
const PRODUCT = "sc4nner";
const FREE_ACCESS = "sc4nner_free";

export type Sc4nnerProvisionPayload = {
  masterIdentityId: string;
  email: string;
  displayName?: string;
  productCode: string;
  entitlement: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSc4nnerEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

// The provisioning address is derived from the configured SC4NNER callback
// (…/auth/callback → …/api/provision), the same derivation SC4NNER uses
// for the inventory bridge. No new environment variable.
export function sc4nnerProvisionUrl(callbackUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  if (url.pathname !== "/auth/callback") return null;
  url.pathname = "/api/provision";
  url.search = "";
  return url.toString();
}

export function buildSc4nnerProvisionPayload(input: {
  identityId: string;
  email: string;
  displayName?: string | null;
}): Sc4nnerProvisionPayload {
  const displayName =
    typeof input.displayName === "string" && input.displayName.trim()
      ? input.displayName.trim().slice(0, 80)
      : undefined;
  return {
    masterIdentityId: input.identityId,
    email: input.email.trim(),
    ...(displayName ? { displayName } : {}),
    productCode: PRODUCT,
    entitlement: FREE_ACCESS,
  };
}

// Upsert of the main-database provider copy. On update, a null email or
// display name never erases a known one, and the provision outcome is left
// untouched (see markSc4nnerProviderProvisionResult).
export async function recordSc4nnerProviderLink(input: {
  identityId: string;
  email: string | null;
  displayName?: string | null;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;
  const email = normalizeSc4nnerEmail(input.email);
  const displayName =
    typeof input.displayName === "string" && input.displayName.trim()
      ? input.displayName.trim().slice(0, 80)
      : null;
  await prisma.providerAccount.upsert({
    where: {
      identityId_source: {
        identityId: input.identityId,
        source: SC4NNER_PROVIDER_SOURCE,
      },
    },
    create: {
      identityId: input.identityId,
      email,
      displayName,
      source: SC4NNER_PROVIDER_SOURCE,
    },
    update: {
      ...(email ? { email } : {}),
      ...(displayName ? { displayName } : {}),
    },
  });
  return true;
}

export async function markSc4nnerProviderProvisionResult(
  identityId: string,
  ok: boolean,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.providerAccount.updateMany({
    where: { identityId, source: SC4NNER_PROVIDER_SOURCE },
    data: {
      provisionStatus: ok ? "provisioned" : "failed",
      ...(ok ? { lastProvisionedAt: new Date() } : {}),
    },
  });
}

// Full provisioning for one authorizing account: record the copy, then call
// SC4NNER. Never throws — the caller (the authorization confirmation) must
// complete even when SC4NNER is unreachable; the record shows the outcome.
export async function provisionSc4nnerAccount(input: {
  identityId: string;
  email: string | null;
  displayName?: string | null;
}): Promise<{ recorded: boolean; provisioned: boolean }> {
  let recorded = false;
  try {
    recorded = await recordSc4nnerProviderLink(input);
  } catch (error) {
    console.error("[sc4nner-provision] provider record failed", error);
    return { recorded: false, provisioned: false };
  }
  const email = normalizeSc4nnerEmail(input.email);
  if (!recorded || !email) return { recorded, provisioned: false };

  const url = sc4nnerProvisionUrl(process.env.SC4NNER_EXPERIENCE_CALLBACK_URL || "");
  const token = process.env.TAKATAK_SC4NNER_SERVICE_TOKEN?.trim() || "";
  if (!url || token.length < 20) {
    // Not configured on this side yet: the record stays "pending" so the
    // gap is visible instead of being reported as a failure or a success.
    return { recorded, provisioned: false };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        buildSc4nnerProvisionPayload({
          identityId: input.identityId,
          email,
          displayName: input.displayName,
        }),
      ),
    });
    await markSc4nnerProviderProvisionResult(input.identityId, response.ok);
    return { recorded, provisioned: response.ok };
  } catch (error) {
    console.error("[sc4nner-provision] SC4NNER call failed", error);
    try {
      await markSc4nnerProviderProvisionResult(input.identityId, false);
    } catch {
      /* the record already shows "pending"; nothing more to write */
    }
    return { recorded, provisioned: false };
  }
}
