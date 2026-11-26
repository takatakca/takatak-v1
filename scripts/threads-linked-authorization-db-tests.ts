/**
 * "Use Threads linked to Facebook" against a real database (CI: ephemeral
 * Supabase). The linked path must check the Meta prerequisites, then start a
 * real Threads authorization with a stored, hashed OAuth state that the
 * Threads callback can verify. Synthetic data only; never prints tokens.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { getPrisma } from "../src/lib/db/prisma";

// Local test configuration (not production secrets).
process.env.THREADS_APP_ID ||= "threads-test-app";
process.env.THREADS_APP_SECRET ||= "threads-test-secret";
process.env.NEXT_PUBLIC_APP_URL ||= "http://localhost:3000";
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 ||= randomBytes(32).toString(
  "base64",
);

type Result = { name: string; ok: boolean; evidence: string };
const results: Result[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function check(name: string, run: () => Promise<string>) {
  try {
    results.push({ name, ok: true, evidence: await run() });
  } catch (error) {
    results.push({
      name,
      ok: false,
      evidence: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("BLOCKED  DATABASE_URL missing");
    process.exit(1);
  }

  const maybePrisma = getPrisma();
  if (!maybePrisma) {
    console.error("BLOCKED  database client could not start");
    process.exit(1);
  }
  const prisma = maybePrisma;

  const { startLinkedThreadsAuthorization } = await import(
    "../src/lib/social/connections/social-threads-account-service"
  );
  const { hashOAuthState } = await import(
    "../src/lib/social/security/social-crypto"
  );

  const stamp = Date.now().toString(36);
  const clientId = randomUUID();
  const otherClientId = randomUUID();
  const ownerId = randomUUID();
  const viewerId = randomUUID();
  const brandId = randomUUID();
  const bareBrandId = randomUUID();
  const metaConnectionId = randomUUID();
  const bareMetaConnectionId = randomUUID();
  const returnPath = "/dashboard/social?connections=open&platform=threads";

  try {
    for (const id of [clientId, otherClientId]) {
      await prisma.client.create({
        data: { id, name: `Threads linked ${stamp} ${id.slice(0, 4)}`, status: "active" },
      });
      // Essential includes Threads (plan-catalog ESSENTIAL_NETWORKS).
      await prisma.clientSubscription.create({
        data: {
          clientId: id,
          status: "active",
          planCode: "social_essential_1",
          developmentBypass: false,
        },
      });
    }

    for (const [id, label] of [
      [ownerId, "owner"],
      [viewerId, "viewer"],
    ] as const) {
      await prisma.profile.create({
        data: {
          id,
          authUserId: randomUUID(),
          email: `threads-linked-${label}-${stamp}@example.test`,
          displayName: label,
          status: "active",
          role: "user",
        },
      });
    }

    await prisma.clientMembership.create({
      data: { profileId: ownerId, clientId, role: "owner", status: "active" },
    });
    await prisma.clientMembership.create({
      data: { profileId: viewerId, clientId, role: "viewer", status: "active" },
    });

    for (const [id, name] of [
      [brandId, "Linked brand"],
      [bareBrandId, "Brand without Instagram"],
    ] as const) {
      await prisma.businessBrand.create({
        data: { id, clientId, name: `${name} ${stamp}`, status: "active" },
      });
    }

    for (const [id, brand] of [
      [metaConnectionId, brandId],
      [bareMetaConnectionId, bareBrandId],
    ] as const) {
      await prisma.socialProviderConnection.create({
        data: {
          id,
          clientId,
          businessBrandId: brand,
          provider: "meta",
          status: "connected",
          scopes: ["pages_show_list", "instagram_basic"],
          authorizedAt: new Date(),
          createdByProfileId: ownerId,
        },
      });
    }

    await prisma.socialAccount.create({
      data: {
        clientId,
        businessBrandId: brandId,
        providerConnectionId: metaConnectionId,
        platform: "instagram",
        accountType: "instagram_professional",
        externalAccountId: `ig-${stamp}`,
        displayName: "Linked Instagram",
        handle: "linked.instagram",
        status: "connected",
        accessStatus: "selected",
      },
    });

    await check("Linked path stores a Threads OAuth state", async () => {
      const authorization = await startLinkedThreadsAuthorization({
        clientId,
        profileId: ownerId,
        connectionId: metaConnectionId,
        returnPath,
      });
      assert(authorization.provider === "threads", "provider threads");
      const url = new URL(authorization.authorizationUrl);
      assert(url.hostname.endsWith("threads.net"), "Threads host");
      const state = url.searchParams.get("state");
      assert(state && state.length >= 32, "random state");
      assert(state !== metaConnectionId, "state is not the connection id");

      const stored = await prisma.socialOAuthState.findUnique({
        where: { stateHash: hashOAuthState(state) },
        select: {
          provider: true,
          status: true,
          clientId: true,
          businessBrandId: true,
          connectionId: true,
          returnPath: true,
          codeVerifierCiphertext: true,
        },
      });
      assert(stored, "state row found by its hash");
      assert(stored.provider === "threads", "stored provider");
      assert(stored.status === "pending", "stored pending");
      assert(stored.clientId === clientId, "same workspace");
      assert(stored.businessBrandId === brandId, "same brand as the Page");
      assert(stored.returnPath === returnPath, "return path");
      assert(stored.codeVerifierCiphertext.length > 0, "PKCE verifier sealed");

      const threadsConnection = stored.connectionId
        ? await prisma.socialProviderConnection.findUnique({
            where: { id: stored.connectionId },
            select: { provider: true, businessBrandId: true },
          })
        : null;
      assert(threadsConnection?.provider === "threads", "own Threads connection");
      assert(threadsConnection.businessBrandId === brandId, "Threads on the same brand");
      return "Threads authorization URL + stored hashed state + own connection";
    });

    await check("Requires a selected Instagram account on the Page", async () => {
      try {
        await startLinkedThreadsAuthorization({
          clientId,
          profileId: ownerId,
          connectionId: bareMetaConnectionId,
          returnPath,
        });
      } catch (error) {
        assert(
          error instanceof Error && /Connect Instagram from Facebook first/.test(error.message),
          error instanceof Error ? error.message : "unexpected error",
        );
        const states = await prisma.socialOAuthState.count({
          where: { clientId, businessBrandId: bareBrandId },
        });
        assert(states === 0, "no state created");
        return "refused, nothing stored";
      }
      throw new Error("expected refusal");
    });

    await check("Requires the manage permission", async () => {
      try {
        await startLinkedThreadsAuthorization({
          clientId,
          profileId: viewerId,
          connectionId: metaConnectionId,
          returnPath,
        });
      } catch (error) {
        assert(
          error instanceof Error && /permission/i.test(error.message),
          error instanceof Error ? error.message : "unexpected error",
        );
        return "viewer refused";
      }
      throw new Error("expected refusal");
    });

    await check("Never reaches another workspace's connection", async () => {
      try {
        await startLinkedThreadsAuthorization({
          clientId: otherClientId,
          profileId: ownerId,
          connectionId: metaConnectionId,
          returnPath,
        });
      } catch (error) {
        assert(error instanceof Error, "error");
        return "refused";
      }
      throw new Error("expected refusal");
    });
  } finally {
    for (const id of [clientId, otherClientId]) {
      await prisma.socialOAuthState.deleteMany({ where: { clientId: id } });
      await prisma.socialAccount.deleteMany({ where: { clientId: id } });
      await prisma.socialCredential.deleteMany({ where: { clientId: id } });
      await prisma.socialProviderConnection.deleteMany({ where: { clientId: id } });
      await prisma.clientMembership.deleteMany({ where: { clientId: id } });
      await prisma.clientSubscription.deleteMany({ where: { clientId: id } });
      await prisma.businessBrand.deleteMany({ where: { clientId: id } });
      await prisma.client.deleteMany({ where: { id } });
    }
    await prisma.profile.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
    await prisma.$disconnect();
  }

  for (const row of results) {
    console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.name} — ${row.evidence}`);
  }
  const failed = results.filter((row) => !row.ok).length;
  if (failed > 0) {
    console.error(`\n${failed} linked Threads check(s) failed.`);
    process.exit(1);
  }
  console.log(`\n${results.length} linked Threads checks passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
