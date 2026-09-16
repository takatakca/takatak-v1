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
  "src/lib/integrations/r2nette/apply-event.ts",
);

const route = readProjectFile(
  "src/lib/integrations/r2nette/events/route.ts",
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

console.log(
  "R2NETTE synchronization safeguards: PASS",
);