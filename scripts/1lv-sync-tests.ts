import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) =>
  readFileSync(resolve(root, path), "utf8");

const schema = read("prisma/schema.prisma");
const parser = read("src/lib/integrations/1lv/parser.ts");
const signature = read("src/lib/integrations/1lv/signature.ts");
const applyEvent = read("src/lib/integrations/1lv/apply-event.ts");
const route = read("src/lib/integrations/1lv/events/route.ts");

assert.match(
  schema,
  /model SourceMerchantProfile[\s\S]*@@unique\(\[sourceApplication, externalMerchantId\]\)/,
  "1LV merchants need source-scoped stable identities.",
);

assert.match(
  schema,
  /model SourceCommerceOrder[\s\S]*@@unique\(\[sourceApplication, externalOrderId\]\)/,
  "1LV orders need source-scoped stable identities.",
);

assert.match(
  schema,
  /model SourceRelationship[\s\S]*customerExternalReference[\s\S]*merchantExternalReference/,
  "1LV customer-merchant relationships must stay structured.",
);

assert.match(
  parser,
  /Event type does not match aggregate type/,
  "1LV event type must be bound to the correct aggregate.",
);

assert.match(
  parser,
  /forbiddenFields/,
  "1LV parser must reject secret-bearing payload fields.",
);

assert.match(
  signature,
  /timingSafeEqual/,
  "1LV signature comparison must be timing-safe.",
);

assert.match(
  signature,
  /idempotencyKey !== eventId/,
  "1LV idempotency key must match the event id.",
);

assert.match(
  applyEvent,
  /sourceSynchronizationEvent\.findUnique/,
  "1LV bridge must check the durable event journal before applying.",
);

assert.match(
  applyEvent,
  /previous\.payloadHash !== payloadHash/,
  "Reused event ids with changed payloads must conflict.",
);

assert.match(
  applyEvent,
  /primaryEmailVerified: true/,
  "Verified 1LV email may promote TAKATAK master identity verification.",
);

assert.match(
  applyEvent,
  /primaryPhoneVerified: true/,
  "Verified 1LV phone may promote TAKATAK master identity verification.",
);

assert.match(
  route,
  /retryable:\s*true/,
  "Temporary TAKATAK failures must remain retryable by 1LV.",
);

console.log("1LV master synchronization safeguards: PASS");
