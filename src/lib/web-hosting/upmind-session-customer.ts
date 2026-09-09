import "server-only";

import {
  ensurePersonalClientWorkspace,
  ensureProfileForAuthenticatedUser,
} from "@/lib/auth/profile-sync";
import { createAuthErrorId } from "@/lib/auth/auth-error-id";
import { getPrisma } from "@/lib/db/prisma";
import { findOrCreateUpmindCustomer } from "@/lib/integrations/upmind/upmind-customers";

export type UpmindSessionCustomer = {
  authenticated: boolean;
  clientId: string | null;
};

const UPMIND_AUTH_TIMEOUT_MS = 2_500;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Attach an Upmind billing customer to a TAKATAK profile if one is not
 * stored yet. Safe to call on every request; no-ops when already linked.
 * Never throws. Never blocks TAKATAK authentication.
 */
export async function linkUpmindCustomerForProfile(
  profileId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const errorId = createAuthErrorId();

  try {
    const result = await withTimeout(
      (async () => {
        const profile = await prisma.profile.findUnique({
          where: { id: profileId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            upmindClientId: true,
          },
        });

        if (!profile) {
          return null;
        }

        await ensurePersonalClientWorkspace(
          profile.id,
          profile.email,
          profile.displayName || profile.email,
        );

        if (profile.upmindClientId) {
          return profile.upmindClientId;
        }

        const { clientId } = await findOrCreateUpmindCustomer({
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: null,
        });

        if (!clientId) {
          return null;
        }

        try {
          await prisma.profile.update({
            where: { id: profile.id },
            data: { upmindClientId: clientId },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            const existing = await prisma.profile.findUnique({
              where: { id: profile.id },
              select: { upmindClientId: true },
            });
            return existing?.upmindClientId ?? null;
          }
          throw error;
        }

        return clientId;
      })(),
      UPMIND_AUTH_TIMEOUT_MS,
    );

    return result;
  } catch {
    console.error(
      `[upmind-session] errorId=${errorId} stage=link_customer profileLinked=false`,
    );
    return null;
  }
}

/**
 * Fire-and-forget Upmind sync after a TAKATAK session already exists.
 * Passenger has no reliable job queue; a short in-process task is enough
 * and must never delay or fail login.
 */
export function scheduleUpmindCustomerLink(profileId: string): void {
  setTimeout(() => {
    void linkUpmindCustomerForProfile(profileId);
  }, 0);
}

/**
 * For a signed-in TAKATAK user, return the Upmind customer id that checkout
 * should attach as client-id so Upmind does not ask for a second account.
 */
export async function getUpmindSessionCustomer(): Promise<UpmindSessionCustomer> {
  const sync = await ensureProfileForAuthenticatedUser();

  if (
    sync.outcome === "denied" ||
    sync.outcome === "unavailable" ||
    sync.outcome === "error"
  ) {
    return {
      authenticated: sync.outcome !== "denied",
      clientId: null,
    };
  }

  const clientId = await linkUpmindCustomerForProfile(sync.profileId);
  return { authenticated: true, clientId };
}
