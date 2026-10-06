import "server-only";

// Client invoicing — connect a client workspace's OWN Stripe account.
// The workspace comes from the server-side access context only; the Stripe
// account id is created and stored by TAKATAK, never accepted from a browser.

import { Prisma } from "@prisma/client";

import { getStripe } from "@/lib/billing/social/stripe-client";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

import {
  buildAccountLinkParams,
  buildConnectAccountCreateParams,
  clientConnectState,
  connectAccountIdempotencyKey,
  readConnectFlags,
  safeOnboardingUrl,
  type ClientConnectFlags,
  type ClientConnectState,
} from "./connect-policy";
import { isClientInvoicingEnabled } from "./env";

export interface ClientConnectStatus {
  enabled: boolean;
  state: ClientConnectState;
  flags: ClientConnectFlags | null;
  lastSyncedAt: string | null;
}

function requirePrisma() {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "La base de données est indisponible.");
  }

  return prisma;
}

function toStatus(row: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country: string | null;
  defaultCurrency: string | null;
  lastSyncedAt: Date | null;
} | null): ClientConnectStatus {
  const flags = row
    ? {
        chargesEnabled: row.chargesEnabled,
        payoutsEnabled: row.payoutsEnabled,
        detailsSubmitted: row.detailsSubmitted,
        country: row.country,
        defaultCurrency: row.defaultCurrency,
      }
    : null;

  return {
    enabled: isClientInvoicingEnabled(),
    state: clientConnectState(flags),
    flags,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
  };
}

export async function getClientConnectStatus(clientId: string): Promise<ClientConnectStatus> {
  const prisma = getPrisma();
  const row = prisma
    ? await prisma.clientStripeConnectAccount.findUnique({ where: { clientId } })
    : null;

  return toStatus(row);
}

/** Server-side Stripe account id for this workspace, or null. */
export async function getClientConnectAccountId(clientId: string): Promise<string | null> {
  const prisma = getPrisma();
  const row = prisma
    ? await prisma.clientStripeConnectAccount.findUnique({ where: { clientId }, select: { stripeAccountId: true } })
    : null;

  return row?.stripeAccountId ?? null;
}

/** Re-reads the account from Stripe and stores its onboarding flags. */
export async function syncClientConnectAccount(clientId: string): Promise<ClientConnectStatus> {
  const prisma = requirePrisma();
  const row = await prisma.clientStripeConnectAccount.findUnique({ where: { clientId } });

  if (!row || !isClientInvoicingEnabled()) {
    return toStatus(row);
  }

  const account = await getStripe().accounts.retrieve(row.stripeAccountId);

  if (account.id !== row.stripeAccountId) {
    throw new ServiceError("unavailable", "Stripe a répondu pour un autre compte.");
  }

  const updated = await prisma.clientStripeConnectAccount.update({
    where: { clientId },
    data: { ...readConnectFlags(account), lastSyncedAt: new Date() },
  });

  return toStatus(updated);
}

export async function startClientConnectOnboarding(input: {
  clientId: string;
  profileId: string;
  email?: string | null;
  requestOrigin?: string | null;
}): Promise<{ url: string }> {
  if (!isClientInvoicingEnabled()) {
    throw new ServiceError("unavailable", "La facturation de vos clients n’est pas encore ouverte.");
  }

  const prisma = requirePrisma();
  const stripe = getStripe();
  let row = await prisma.clientStripeConnectAccount.findUnique({ where: { clientId: input.clientId } });

  if (!row) {
    let account: { id: string };

    try {
      account = await stripe.accounts.create(
        buildConnectAccountCreateParams({ clientId: input.clientId, email: input.email }),
        { idempotencyKey: connectAccountIdempotencyKey(input.clientId) },
      );
    } catch (error) {
      // Same key already in flight (a simultaneous click): Stripe refuses the
      // second request instead of creating a second account.
      if ((error as { type?: unknown })?.type === "StripeIdempotencyError") {
        throw new ServiceError("conflict", "La configuration Stripe est déjà en cours d’ouverture. Réessayez dans un instant.");
      }

      throw error;
    }

    try {
      row = await prisma.clientStripeConnectAccount.create({
        data: {
          clientId: input.clientId,
          stripeAccountId: account.id,
          connectedByProfileId: input.profileId,
          ...readConnectFlags(account as Parameters<typeof readConnectFlags>[0]),
          lastSyncedAt: new Date(),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      // A simultaneous click stored the link first: keep the stored one.
      row = await prisma.clientStripeConnectAccount.findUnique({ where: { clientId: input.clientId } });

      if (!row) {
        throw error;
      }
    }
  }

  if (clientConnectState(row) === "active") {
    throw new ServiceError("conflict", "Votre compte Stripe est déjà connecté et actif.");
  }

  const link = await stripe.accountLinks.create(
    buildAccountLinkParams({ accountId: row.stripeAccountId, origin: getApplicationOrigin(input.requestOrigin) }),
  );
  const url = safeOnboardingUrl(link.url);

  if (!url) {
    throw new ServiceError("unavailable", "Stripe n’a pas ouvert la configuration du compte. Réessayez.");
  }

  return { url };
}

/**
 * Applies a verified Connect `account.updated` event. Only accounts TAKATAK
 * created and linked are touched; unknown accounts are ignored.
 */
export async function applyConnectAccountUpdated(event: {
  account?: string | null;
  data: { object: unknown };
}): Promise<"updated" | "ignored"> {
  const account = event.data.object as { id?: unknown } | null;

  if (
    typeof event.account !== "string" ||
    !account ||
    typeof account.id !== "string" ||
    account.id !== event.account
  ) {
    return "ignored";
  }

  const prisma = requirePrisma();
  const result = await prisma.clientStripeConnectAccount.updateMany({
    where: { stripeAccountId: account.id },
    data: { ...readConnectFlags(account as Parameters<typeof readConnectFlags>[0]), lastSyncedAt: new Date() },
  });

  return result.count > 0 ? "updated" : "ignored";
}
