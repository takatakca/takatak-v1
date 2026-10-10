// TK-069: a saved draft can be handed to social approval, and credit cost stays an estimate.
// Run: npm run qa:ai-handoff
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { decideHandoff, handoffNotice, readHandoffPostId } from "../src/lib/ai/handoff";
import { creditsSpent, estimateCadCents, formatCad, monthStartUtc } from "../src/lib/ai/usage";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("a draft with text is ready to send", () => {
  assert.deepEqual(decideHandoff({ status: "saved", content: "Bonjour", metadata: null }), { action: "create" });
  assert.deepEqual(decideHandoff({ status: "draft", content: "Bonjour", metadata: {} }), { action: "create" });
});

check("an archived or empty draft is refused", () => {
  assert.deepEqual(decideHandoff({ status: "archived", content: "Bonjour", metadata: null }), {
    action: "refused",
    reason: "archived",
  });
  assert.deepEqual(decideHandoff({ status: "saved", content: "   ", metadata: null }), {
    action: "refused",
    reason: "empty",
  });
});

check("a sent draft with a post id is not sent again", () => {
  const metadata = { socialPostId: "post-1", approvalId: "ap-1" };
  assert.equal(readHandoffPostId(metadata), "post-1");
  assert.equal(readHandoffPostId(["post-1"]), null);
  assert.deepEqual(decideHandoff({ status: "sent_to_approval", content: "Bonjour", metadata }), {
    action: "already_sent",
    socialPostId: "post-1",
  });
});

check("a sent draft missing its post id can be repaired", () => {
  assert.deepEqual(decideHandoff({ status: "sent_to_approval", content: "Bonjour", metadata: {} }), { action: "create" });
});

check("credit spend is the absolute sum of debits since the month start", () => {
  const since = monthStartUtc(new Date("2026-10-15T12:00:00.000Z"));
  assert.equal(since.toISOString(), "2026-10-01T00:00:00.000Z");
  const spent = creditsSpent(
    [
      { delta: -4, createdAt: new Date("2026-10-02T00:00:00.000Z") },
      { delta: 100, createdAt: new Date("2026-10-03T00:00:00.000Z") },
      { delta: -2, createdAt: new Date("2026-09-30T00:00:00.000Z") },
    ],
    since,
  );
  assert.equal(spent, 4);
  assert.equal(estimateCadCents(spent), 60);
  assert.equal(estimateCadCents(10), 150);
  assert.equal(estimateCadCents(-1), 0);
  assert.equal(formatCad(150), "1.50 $ CA");
});

check("notices stay on the known codes", () => {
  assert.equal(handoffNotice("sent")?.tone, "ok");
  assert.equal(handoffNotice("nope"), null);
});

check("the handoff writes a pending social post and does not add a migration", () => {
  const handoff = readFileSync("src/lib/ai/handoff.ts", "utf8");
  const usage = readFileSync("src/lib/ai/usage.ts", "utf8");
  const saved = readFileSync("src/app/dashboard/ai-studio/saved/page.tsx", "utf8");
  const card = readFileSync("src/components/ai-studio/saved-output-card.tsx", "utf8");
  const page = readFileSync("src/app/dashboard/ai-studio/usage/page.tsx", "utf8");
  assert.match(handoff, /pending_approval/);
  assert.match(handoff, /sent_to_approval/);
  assert.match(handoff, /clientId: \{ in: input\.clientIds \}/);
  assert.doesNotMatch(handoff, /\$executeRaw|prisma\/migrations/);
  assert.match(usage, /delta: \{ lt: 0 \}/);
  assert.match(usage, /clientIds\.length !== 1/);
  assert.doesNotMatch(saved, /no send actions exist yet/);
  assert.match(card, /Envoyer à l'approbation/);
  assert.match(page, /Ceci n'est pas une facture/);
});

console.log(`\n${passed} ai handoff checks passed`);
