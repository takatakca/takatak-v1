import { readFileSync } from "node:fs";

import { defaultJobOptions } from "../src/lib/queue/job-options";
import {
  QUEUE_NAMES,
  SKIPPED_QUEUES,
  queueEnabled,
  queuePrefix,
  webhookQueueEnabled,
} from "../src/lib/queue/names";
import {
  isPermanentUnauthorized,
  parseJobPayload,
} from "../src/lib/queue/payloads";
import { readRedisReadiness, redisUrlProblem } from "../src/lib/queue/redis";
import { deferProviderWebhook, signalQueueJob } from "../src/lib/queue/signal";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

async function main() {
  console.log("[queue] foundation");

  const options = defaultJobOptions();
  assert("retries three times", options.attempts === 3);
  assert(
    "uses exponential backoff",
    typeof options.backoff === "object" &&
      options.backoff !== null &&
      "type" in options.backoff &&
      options.backoff.type === "exponential",
  );

  const payload = parseJobPayload({
    workspaceId: "11111111-1111-4111-8111-111111111111",
    connectionId: "22222222-2222-4222-8222-222222222222",
    provider: "meta",
    eventId: "33333333-3333-4333-8333-333333333333",
  });
  assert("accepts identifier payload", payload.provider === "meta");

  let rejected = false;
  try {
    parseJobPayload({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      connectionId: null,
      provider: "stripe",
      eventId: "evt_test",
      secret: "nope",
    });
  } catch {
    rejected = true;
  }
  assert("rejects extra payload fields", rejected);

  rejected = false;
  try {
    parseJobPayload({
      workspaceId: "https://example.test/secret",
      connectionId: null,
      provider: "stripe",
      eventId: "evt_test",
    });
  } catch {
    rejected = true;
  }
  assert("rejects URL-shaped identifiers", rejected);

  assert("401 is permanent", isPermanentUnauthorized(new Error("HTTP 401 unauthorized")));
  assert(
    "timeout is not permanent",
    !isPermanentUnauthorized(new Error("connect ETIMEDOUT")),
  );

  const saved = {
    REDIS_URL: process.env.REDIS_URL,
    TAKATAK_QUEUE_ENABLED: process.env.TAKATAK_QUEUE_ENABLED,
    TAKATAK_QUEUE_WEBHOOKS: process.env.TAKATAK_QUEUE_WEBHOOKS,
    TAKATAK_QUEUE_PREFIX: process.env.TAKATAK_QUEUE_PREFIX,
  };
  delete process.env.REDIS_URL;
  delete process.env.TAKATAK_QUEUE_ENABLED;
  delete process.env.TAKATAK_QUEUE_WEBHOOKS;
  delete process.env.TAKATAK_QUEUE_PREFIX;

  assert("queue is off by default", queueEnabled() === false);
  assert("webhook queue is off by default", webhookQueueEnabled() === false);
  assert("default prefix is takatak", queuePrefix() === "takatak");
  assert(
    "redis readiness is not configured",
    (await readRedisReadiness()) === "not_configured",
  );
  assert(
    "disabled signal does not throw",
    (await signalQueueJob({
      queue: QUEUE_NAMES.socialSync,
      payload,
    })) === undefined,
  );
  assert(
    "disabled webhook defer stays inline",
    (await deferProviderWebhook({
      workspaceId: null,
      connectionId: null,
      provider: "stripe",
      eventId: "evt_test",
    })) === false,
  );

  process.env.TAKATAK_QUEUE_PREFIX = "Bad Prefix";
  rejected = false;
  try {
    queuePrefix();
  } catch {
    rejected = true;
  }
  assert("rejects an unsafe queue prefix", rejected);

  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  assert("rediss URL is acceptable", redisUrlProblem("rediss://cache.internal:6379/0") === null);
  assert(
    "http redis URL is rejected",
    redisUrlProblem("http://cache.internal:6379") !== null,
  );
  assert(
    "public bind host is rejected",
    redisUrlProblem("redis://0.0.0.0:6379") !== null,
  );

  const redisSource = readFileSync("src/lib/queue/redis.ts", "utf8");
  assert("redis module has no NEXT_PUBLIC", !redisSource.includes("NEXT_PUBLIC_"));
  assert("social queue exists", QUEUE_NAMES.socialSync === "social-sync");
  assert("analytics queue exists", QUEUE_NAMES.analyticsSync === "analytics-sync");
  assert("webhook queue exists", QUEUE_NAMES.webhooks === "webhooks");
  assert("email queue is skipped", SKIPPED_QUEUES.includes("email"));

  if (failed > 0) {
    console.error(`[queue] ${failed} failed`);
    process.exit(1);
  }
  console.log("[queue] passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.name : "queue-test-failed");
  process.exit(1);
});
