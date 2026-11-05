// Homepage promo codes, against a real database (ephemeral CI Postgres or
// local): FIRST10 (10 % on the first service) is used once per account,
// recorded in the audit log; a second order gets no discount; another
// account is not affected; a seasonal code is refused outside its dates.
// Synthetic data only; refuses non-loopback databases.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { promoAuditStore } from "@/lib/promotions/audit-store";
import { seasonalCampaigns } from "@/lib/promotions/seasons";
import { claimPromo, previewPromo, promoStatus, redeemPromo } from "@/lib/promotions/service";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const prisma = getPrisma()!;
  const store = promoAuditStore(prisma);
  const marie = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `promo-${randomUUID()}@example.test` } });
  const jean = await prisma.profile.create({ data: { authUserId: randomUUID(), email: `promo-${randomUUID()}@example.test` } });

  const before = await previewPromo(store, marie.id, PROMO_CODE, 49_900);
  assert.ok(before.ok && before.preview.accepted);
  assert.equal(before.preview.discountCents, Math.round(49_900 * PROMO_PERCENT / 100));
  assert.equal(before.preview.totalCents, 49_900 - before.preview.discountCents);
  console.log(`PASS ${PROMO_CODE} takes ${PROMO_PERCENT} % off a new account's first order (server-side quote)`);

  const claimed = await claimPromo(store, marie.id, PROMO_CODE.toLowerCase());
  assert.ok(claimed.ok, "codes are read in any case");
  assert.equal(await promoStatus(store, marie.id, PROMO_CODE), "claimed");
  assert.equal(await redeemPromo(store, marie.id, PROMO_CODE, "REF12345"), "redeemed");
  assert.equal(await redeemPromo(store, marie.id, PROMO_CODE, "REF67890"), "already_redeemed");
  const after = await previewPromo(store, marie.id, PROMO_CODE, 49_900);
  assert.ok(after.ok && !after.preview.accepted && after.preview.discountCents === 0 && after.preview.totalCents === 49_900);
  const again = await claimPromo(store, marie.id, PROMO_CODE);
  assert.ok(!again.ok && again.code === "already_redeemed");
  console.log("PASS once used, the code gives nothing more on that account: a second order pays full price");

  const audits = await prisma.auditLog.findMany({ where: { profileId: marie.id, entityType: "promotion" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audits.map((a) => a.action), ["promo.claim", "promo.redeem"]);
  assert.equal((audits[1].metadata as { orderRef?: string }).orderRef, "REF12345", "the order that used it is recorded");
  console.log("PASS the claim and the use are in the audit log, with the order reference");

  assert.equal(await promoStatus(store, jean.id, PROMO_CODE), "none");
  const other = await previewPromo(store, jean.id, PROMO_CODE, 10_000);
  assert.ok(other.ok && other.preview.discountCents === 1_000);
  console.log("PASS another account still gets its own first-order discount");

  const now = new Date();
  const notLive = [...seasonalCampaigns(now.getUTCFullYear()), ...seasonalCampaigns(now.getUTCFullYear() + 1)].find(
    (c) => Date.parse(c.startsAt) > now.getTime(),
  );
  assert.ok(notLive, "there is always a coming campaign");
  const early = await previewPromo(store, jean.id, notLive.code, 10_000);
  assert.ok(!early.ok && early.code === "invalid_code", `${notLive.code} must not work before ${notLive.startsAt}`);
  assert.equal(await redeemPromo(store, jean.id, notLive.code, "REF00000"), "invalid_code");
  assert.equal(await redeemPromo(store, jean.id, "NOTACODE", "REF00000"), "invalid_code");
  console.log(`PASS a seasonal code (${notLive.code}) is refused before its dates, and an unknown code is refused`);

  await prisma.auditLog.deleteMany({ where: { profileId: { in: [marie.id, jean.id] } } });
  await prisma.profile.deleteMany({ where: { id: { in: [marie.id, jean.id] } } });
  await prisma.$disconnect();
  console.log("promotion DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
