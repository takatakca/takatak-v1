import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(
    resolve(projectRoot, path),
    "utf8",
  );
}

const schema = readProjectFile(
  "prisma/schema.prisma",
);

const applyEvent = readProjectFile(
  "src/lib/integrations/rentauto/apply-event.ts",
);

const route = readProjectFile(
  "src/lib/integrations/rentauto/events/route.ts",
);

const profileSync = readProjectFile(
  "src/lib/auth/profile-sync.ts",
);

assert.match(
  schema,
  /model SourceSynchronizationEvent[\s\S]*responsePayload\s+Json\?/,
  "SourceSynchronizationEvent must contain responsePayload Json?.",
);

assert.match(
  applyEvent,
  /if\s*\(previousEvent\.responsePayload\)/,
  "Duplicate events must use the stored response payload.",
);

assert.match(
  applyEvent,
  /return previousEvent\.responsePayload as/,
  "Duplicate events must return the stored response.",
);

assert.match(
  applyEvent,
  /responsePayload:\s*paymentResponse as Prisma\.InputJsonValue/,
  "Payment synchronization must store its response.",
);

assert.match(
  applyEvent,
  /responsePayload:\s*profileResponse as Prisma\.InputJsonValue/,
  "Profile synchronization must store its response.",
);

assert.match(
  route,
  /retryable:\s*true/,
  "Temporary TAKATAK failures must be marked retryable.",
);

assert.match(
  route,
  /"Retry-After":\s*"30"/,
  "Temporary TAKATAK failures must provide Retry-After.",
);

assert.match(
  applyEvent,
  /transaction\.profile\.findUnique\([\s\S]*where:\s*\{\s*email\s*\}/,
  "Verified Rentauto email must resolve an existing TAKATAK profile.",
);

assert.match(
  applyEvent,
  /profileId:\s*platformProfile\.id/,
  "Rentauto synchronization must attach the master identity to the TAKATAK profile.",
);

assert.match(
  profileSync,
  /ensureMasterIdentityForVerifiedProfile/,
  "TAKATAK auth profile synchronization must create or attach a master identity.",
);

assert.match(
  profileSync,
  /primaryEmailVerified:\s*true/,
  "Verified TAKATAK email must promote the master identity verification state.",
);

console.log(
  "RENTAUTO synchronization safeguards: PASS",
);