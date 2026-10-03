import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const browserWriteRoutes = [
  "src/app/api/billing/hockey/checkout/route.ts",
  "src/app/api/billing/hockey/portal/route.ts",
  "src/app/api/billing/hockey/supporter-credit/redeem/route.ts",
  "src/app/api/hockey/calendar/google/start/route.ts",
  "src/app/api/hockey/calendar/google/disconnect/route.ts",
  "src/app/api/hockey/parent/preferences/route.ts",
  "src/app/api/hockey/travel/origin/route.ts",
  "src/app/api/hockey/family/route.ts",
  "src/app/api/hockey/family/[familyId]/children/route.ts",
  "src/app/api/hockey/family/[familyId]/members/[memberId]/teams/route.ts",
  "src/app/api/hockey/family/[familyId]/invites/route.ts",
  "src/app/api/hockey/family/[familyId]/invites/[inviteId]/route.ts",
  "src/app/api/hockey/family/invites/accept/route.ts",
];

for (const path of browserWriteRoutes) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /hasValidWriteOrigin/, path);
  assert.match(source, /403/, path);
}

for (const serverOnlyRoute of [
  "src/app/api/billing/hockey/webhook/route.ts",
  "src/app/api/integrations/ahmv/team-events/route.ts",
  "src/app/api/integrations/ahmv/team-directory/route.ts",
  "src/app/api/internal/hockey/delivery/run/route.ts",
]) {
  const source = readFileSync(serverOnlyRoute, "utf8");
  assert.doesNotMatch(
    source,
    /The request origin could not be verified/,
    serverOnlyRoute,
  );
}

const stripeWebhook = readFileSync(
  "src/app/api/billing/hockey/webhook/route.ts",
  "utf8",
);
assert.match(stripeWebhook, /stripe/i);

const eventSync = readFileSync(
  "src/app/api/integrations/ahmv/team-events/route.ts",
  "utf8",
);
assert.match(eventSync, /verifyAhmvTeamEventRequest/);

const internalWorker = readFileSync(
  "src/app/api/internal/hockey/delivery/run/route.ts",
  "utf8",
);
assert.match(internalWorker, /verifyHockeyDeliveryWorker/);

console.log("verify-hockey-write-origin: all checks passed");
