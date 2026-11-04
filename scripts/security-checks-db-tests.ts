// Security screens, against a real database (ephemeral CI Postgres or local):
// the support identity check (« Êtes-vous en contact avec le soutien
// TAKATAK ? » + match the number) and the new-device sign-in check
// (« C'était vous ? » on the other devices). The number to tap is never shown
// to the device that must tap it; wrong numbers, expiry, other accounts and
// double answers are refused; every step is in the audit log.
// Synthetic data only; refuses non-loopback databases.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getPrisma } from "@/lib/db/prisma";
import { deviceLabel, ipHint } from "@/lib/security/checks/device";
import { matchChoices } from "@/lib/security/checks/numbers";
import {
  MAX_ATTEMPTS,
  SUPPORT_CHECK_TTL_MS,
  agentCheckStatus,
  createSupportCheck,
  noteDeviceSeen,
  ownSignInCheck,
  pendingPrompts,
  respondToCheck,
} from "@/lib/security/checks/store";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://invalid").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Refusing to run: DATABASE_URL must be loopback.");
  }
  const db = getPrisma()!;
  const mk = (status: "active" | "disabled" = "active") =>
    db.profile.create({ data: { authUserId: randomUUID(), email: `sec-${randomUUID()}@example.test`, status } });
  const agent = await mk();
  const otherAgent = await mk();
  const client = await mk();
  const stranger = await mk();
  const disabled = await mk("disabled");
  const ids = [agent.id, otherAgent.id, client.id, stranger.id, disabled.id];

  try {
    // Pure helpers
    for (let i = 0; i < 200; i += 1) {
      const { matchNumber, choices } = matchChoices();
      assert.equal(new Set(choices).size, 3);
      assert.ok(choices.every((n) => n >= 10 && n <= 99));
      assert.ok(choices.includes(matchNumber));
      assert.deepEqual([...choices].sort((a, b) => a - b), choices);
    }
    assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"), "Chrome sur Windows");
    assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "en"), "Safari on iPhone");
    assert.equal(ipHint("203.0.113.42, 10.0.0.1"), "203.0.113.x");
    console.log("PASS three distinct two-digit numbers, the right one among them; readable device names; partial IP only");

    // Support identity check: who may ask
    assert.deepEqual(await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: agent.id }), { ok: false, code: "self" });
    assert.deepEqual(await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: disabled.id }), { ok: false, code: "disabled" });
    assert.deepEqual(await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: randomUUID() }), { ok: false, code: "not_found" });
    console.log("PASS an agent cannot check themselves, a disabled account or an unknown account");

    const t0 = new Date();
    const asked = await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: client.id, now: t0 });
    assert.ok(asked.ok);
    const seen = await pendingPrompts(db, { profileId: client.id, deviceId: null, now: t0 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].kind, "support_identity");
    assert.ok(seen[0].choices.includes(asked.matchNumber));
    assert.ok(!("matchNumber" in seen[0]), "the client's device never receives the number to tap");
    assert.equal((await pendingPrompts(db, { profileId: stranger.id, deviceId: null, now: t0 })).length, 0);
    assert.equal(await agentCheckStatus(db, { checkId: asked.checkId, agentProfileId: otherAgent.id, now: t0 }), null, "only the agent who asked follows it");
    console.log("PASS the client's devices get the question and three numbers, not the answer; nobody else sees it");

    const wrong = seen[0].choices.find((n) => n !== asked.matchNumber)!;
    const rStranger = await respondToCheck(db, { profileId: stranger.id, checkId: asked.checkId, deviceId: null, answer: asked.matchNumber, now: t0 });
    assert.deepEqual(rStranger, { ok: false, code: "not_found" }, "another account cannot answer");
    assert.equal(MAX_ATTEMPTS, 1, "one tap only: a blind tap passes one time in three");
    const r1 = await respondToCheck(db, { profileId: client.id, checkId: asked.checkId, deviceId: null, answer: wrong, now: t0 });
    assert.ok(r1.ok && r1.status === "mismatch");
    assert.deepEqual(
      await respondToCheck(db, { profileId: client.id, checkId: asked.checkId, deviceId: null, answer: asked.matchNumber, now: t0 }),
      { ok: false, code: "closed" },
      "no second try after a wrong number",
    );
    assert.equal((await agentCheckStatus(db, { checkId: asked.checkId, agentProfileId: agent.id, now: t0 }))?.status, "mismatch");
    console.log("PASS another account cannot answer; one wrong tap closes the check and the agent sees « mauvais nombre »");

    const asked2 = await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: client.id, now: t0 });
    assert.ok(asked2.ok);
    const ok2 = await respondToCheck(db, { profileId: client.id, checkId: asked2.checkId, deviceId: null, answer: asked2.matchNumber, now: t0 });
    assert.ok(ok2.ok && ok2.status === "confirmed");
    const again = await respondToCheck(db, { profileId: client.id, checkId: asked2.checkId, deviceId: null, answer: "not_me", now: t0 });
    assert.deepEqual(again, { ok: false, code: "closed" }, "an answered check cannot be answered again");
    const view2 = await agentCheckStatus(db, { checkId: asked2.checkId, agentProfileId: agent.id, now: t0 });
    assert.ok(view2?.status === "confirmed" && view2.respondedAt);
    console.log("PASS the right number confirms it for the agent; a second answer is refused");

    const asked3 = await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: client.id, now: t0 });
    assert.ok(asked3.ok);
    const no3 = await respondToCheck(db, { profileId: client.id, checkId: asked3.checkId, deviceId: null, answer: "not_me", now: t0 });
    assert.ok(no3.ok && no3.status === "denied");
    console.log("PASS « Non, ce n'est pas moi » tells the agent to stop");

    const asked4 = await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: client.id, now: t0 });
    assert.ok(asked4.ok);
    const late = new Date(t0.getTime() + SUPPORT_CHECK_TTL_MS + 1_000);
    assert.equal((await pendingPrompts(db, { profileId: client.id, deviceId: null, now: late })).length, 0);
    assert.deepEqual(await respondToCheck(db, { profileId: client.id, checkId: asked4.checkId, deviceId: null, answer: asked4.matchNumber, now: late }), { ok: false, code: "closed" });
    assert.equal((await agentCheckStatus(db, { checkId: asked4.checkId, agentProfileId: agent.id, now: late }))?.status, "expired");
    console.log("PASS after 3 minutes the question disappears and the agent sees « expiré »");

    for (let i = 0; i < 3; i += 1) assert.ok((await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: stranger.id, now: t0 })).ok);
    assert.deepEqual(await createSupportCheck(db, { agentProfileId: agent.id, targetProfileId: stranger.id, now: t0 }), { ok: false, code: "too_many" });
    console.log("PASS no more than 3 open questions per person (no flooding)");

    // New-device sign-in check
    const laptop = "a".repeat(32);
    const phone = "b".repeat(32);
    const first = await noteDeviceSeen(db, { profileId: client.id, deviceId: laptop, label: "Chrome sur Windows", ipHint: "203.0.113.x", now: t0 });
    assert.deepEqual(first, { isNew: true, signInCheck: null }, "the account's first device is not a « new sign-in »");
    const repeat = await noteDeviceSeen(db, { profileId: client.id, deviceId: laptop, label: "Chrome sur Windows", ipHint: "203.0.113.x", now: t0 });
    assert.deepEqual(repeat, { isNew: false, signInCheck: null });
    const second = await noteDeviceSeen(db, { profileId: client.id, deviceId: phone, label: "Safari sur iPhone", ipHint: "198.51.100.x", now: t0 });
    assert.ok(second.isNew && second.signInCheck);
    const onLaptop = await pendingPrompts(db, { profileId: client.id, deviceId: laptop, now: t0 });
    const onPhone = await pendingPrompts(db, { profileId: client.id, deviceId: phone, now: t0 });
    assert.ok(onLaptop.some((p) => p.kind === "new_sign_in" && p.deviceLabel === "Safari sur iPhone"));
    assert.ok(!onPhone.some((p) => p.kind === "new_sign_in"), "the new device is never asked about itself");
    const own = await ownSignInCheck(db, { profileId: client.id, deviceId: phone, now: t0 });
    assert.ok(own && own.status === "pending" && own.matchNumber === second.signInCheck.matchNumber, "the new device shows the number to tap");
    console.log("PASS a new device opens « C'était vous ? » on the other devices only, and shows the number itself");

    assert.deepEqual(
      await respondToCheck(db, { profileId: client.id, checkId: second.signInCheck.checkId, deviceId: phone, answer: second.signInCheck.matchNumber, now: t0 }),
      { ok: false, code: "own_device" },
      "a device cannot approve its own sign-in",
    );
    const approved = await respondToCheck(db, { profileId: client.id, checkId: second.signInCheck.checkId, deviceId: laptop, answer: second.signInCheck.matchNumber, now: t0 });
    assert.ok(approved.ok && approved.status === "confirmed");
    assert.equal((await ownSignInCheck(db, { profileId: client.id, deviceId: phone, now: t0 }))?.status, "confirmed");
    console.log("PASS the other device taps the right number: the new device shows « Connexion approuvée »");

    const third = await noteDeviceSeen(db, { profileId: client.id, deviceId: "c".repeat(32), label: "Firefox sur Linux", ipHint: null, now: t0 });
    assert.ok(third.signInCheck);
    const denied = await respondToCheck(db, { profileId: client.id, checkId: third.signInCheck.checkId, deviceId: laptop, answer: "not_me", now: t0 });
    assert.ok(denied.ok && denied.status === "denied" && denied.kind === "new_sign_in");
    console.log("PASS « Ce n'était pas moi » closes the check as denied (the route then closes the other sessions)");

    const audits = await db.auditLog.findMany({ where: { profileId: client.id, entityType: "security_check" }, select: { action: true } });
    const actions = new Set(audits.map((a) => a.action));
    for (const a of [
      "security.support_check.requested",
            "security.support_identity.mismatch",
      "security.support_identity.confirmed",
      "security.support_identity.denied",
      "security.new_device",
      "security.new_sign_in.confirmed",
      "security.new_sign_in.denied",
    ]) {
      assert.ok(actions.has(a), `audit log has ${a}`);
    }
    console.log("PASS every request, answer and new device is in the audit log");
  } finally {
    await db.auditLog.deleteMany({ where: { profileId: { in: ids } } });
    await db.securityCheck.deleteMany({ where: { profileId: { in: ids } } });
    await db.securityDevice.deleteMany({ where: { profileId: { in: ids } } });
    await db.profile.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
  console.log("security checks DB tests: OK");
}

main().catch(async (error) => {
  console.error("FAIL", error);
  await getPrisma()?.$disconnect();
  process.exit(1);
});
