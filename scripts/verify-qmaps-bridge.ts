// TK-004 / TK-024: a QMAPS link or reply is confirmed only when QMAPS accepts it.
// Run: npm run qa:qmaps-bridge
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { linkMessage, linkStateFor, readLinkState, readReplyState, replyOutcome } from "../src/lib/qmaps/bridge";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("a missing QMAPS integration never counts as confirmed", () => {
  const remote = { ok: false as const, reason: "not_configured" as const };
  assert.equal(linkStateFor(remote), "saved_in_takatak");
  assert.match(linkMessage(remote), /n'est pas configuré/);
  assert.doesNotMatch(linkMessage(remote), /confirmé sur QMAPS/i);
  const reply = replyOutcome(remote);
  assert.equal(reply.replyState, "not_sent");
  assert.equal(reply.replyStatus, "draft_reply");
  assert.match(reply.message, /n'a pas été envoyée/);
});

check("only an accepted call is confirmed", () => {
  assert.equal(linkStateFor({ ok: true }), "confirmed_on_qmaps");
  assert.equal(replyOutcome({ ok: true }).replyState, "sent_to_qmaps");
  assert.equal(replyOutcome({ ok: false, reason: "refused" }).replyState, "not_sent");
});

check("stored metadata is read back without inventing a link", () => {
  assert.equal(readLinkState({ linkState: "confirmed_on_qmaps" }), "confirmed_on_qmaps");
  assert.equal(readLinkState({ linkState: "connected" }), null);
  assert.equal(readReplyState({ replyState: "sent_to_qmaps" }), "sent_to_qmaps");
  assert.equal(readReplyState(null), null);
});

check("the admin screen and the reply action do not add a migration", () => {
  const action = readFileSync("src/app/dashboard/admin/qmaps/actions.ts", "utf8");
  const reply = readFileSync("src/app/dashboard/local-listings/reviews/actions.ts", "utf8");
  const page = readFileSync("src/app/dashboard/admin/qmaps/page.tsx", "utf8");
  assert.match(action, /provider: "qmaps"/);
  assert.match(action, /postQmaps\("takatak-link-business"/);
  assert.match(reply, /postQmaps\("takatak-reply-review"/);
  assert.match(page, /Confirmé sur QMAPS/);
  assert.doesNotMatch(`${action}\n${reply}`, /prisma\/migrations/);
});

console.log(`${passed} checks passed`);
