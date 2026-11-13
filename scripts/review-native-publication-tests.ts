import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canonicalReviewReply } from "../src/lib/reputation/review-target-model";

const clientId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const reviewId = "44444444-4444-4444-8444-444444444444";
const attemptId = "55555555-5555-4555-8555-555555555555";
const foreignId = "99999999-9999-4999-8999-999999999999";
const now = "2026-11-06T12:00:00.000Z";
const text = "Synthetic approved response; no actual customer data.";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const clone = <T>(value: T): T => structuredClone(value);
const version = (date: Date, reply: string | null, input: unknown) =>
  digest(JSON.stringify([date.toISOString(), reply, input]));
type Result =
  | { ok: true; runId: string; replayed: boolean; confirmedAt: string }
  | { ok: false; code: string };
type Row = {
  id: string;
  clientId: string;
  agentKey: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  updatedAt: Date;
  claimedAt: Date | null;
  completedAt: Date | null;
};
type Query = { where: Record<string, unknown>; data?: Record<string, unknown> };
type Publish = (
  client: string,
  actor: string,
  run: string,
  hash: string,
  deps?: unknown,
) => Promise<Result>;
const filename = resolve(
  process.cwd(),
  "src/lib/reputation/review-native-publication.ts",
);

function fixture() {
  const target = {
    id: reviewId,
    source: "google",
    author: "Synthetic author",
    location: "Synthetic location",
    rating: 4,
    text: "Synthetic review",
    fingerprint: digest("synthetic-target"),
    replyText: null,
    replyAt: null,
  };
  const state = {
    row: {
      id: runId,
      clientId,
      agentKey: "review_responder",
      status: "approved",
      input: {
        source: "google",
        reviewResponseId: reviewId,
        reviewWorkflowVersion: 2,
        reviewContentHash: target.fingerprint,
        reviewApproval: {
          replyText: text,
          replyHash: digest(text),
          targetHash: target.fingerprint,
          at: now,
          profileId: actorId,
        },
      },
      output: { reply: text, preserved: "other output" },
      updatedAt: new Date(now),
      claimedAt: null,
      completedAt: null,
    } as Row,
    target: target as typeof target | null,
    enabled: true,
    entitled: true,
    audits: [] as Record<string, unknown>[],
    auditError: false,
    receiptMode: "confirmed",
    claimRace: false,
    terminalRace: false,
    terminalError: false,
    publicationThrow: false,
    publisherCalls: 0,
    receiptMutator: (_receipt: Record<string, unknown>) => {},
    queryCalls: [] as { kind: string; args: unknown }[],
  };
  const matches = (where: Record<string, unknown>) => {
    for (const key of ["id", "clientId", "agentKey", "status"]) {
      const expected = where[key];
      const actual = state.row[key as keyof Row];
      if (
        expected !== undefined &&
        (object(expected).in
          ? !(object(expected).in as unknown[]).includes(actual)
          : expected !== actual)
      )
        return false;
    }
    if (
      where.updatedAt &&
      String(state.row.updatedAt) !== String(where.updatedAt)
    )
      return false;
    for (const key of ["input", "output"] as const)
      if (
        where[key] &&
        JSON.stringify(state.row[key]) !==
          JSON.stringify(object(where[key]).equals)
      )
        return false;
    return true;
  };
  const read = async (args: Query) => {
    state.queryCalls.push({ kind: "read", args: clone(args) });
    return matches(args.where) ? clone(state.row) : null;
  };
  const db = {
    aiAgentRun: {
      findFirst: read,
      findUnique: read,
      updateMany: async (args: Query) => {
        state.queryCalls.push({ kind: "update", args: clone(args) });
        if (args.data?.status === "executing" && state.claimRace) {
          state.row.status = "executing";
          return { count: 0 };
        }
        if (args.data?.status === "completed" && state.terminalRace)
          return { count: 0 };
        if (args.data?.status === "completed" && state.terminalError)
          throw Error("synthetic storage error");
        if (!matches(args.where)) return { count: 0 };
        Object.assign(state.row, clone(args.data));
        return { count: 1 };
      },
    },
    aiAgentSetting: {
      findUnique: async () => ({
        enabled: state.enabled,
        requireApproval: true,
      }),
    },
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        if (state.auditError) throw Error("synthetic audit failure");
        state.audits.push(clone(args.data));
        return { id: "synthetic-audit" };
      },
    },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
      const previous = clone({ row: state.row, audits: state.audits });
      try {
        return await work(db);
      } catch (error) {
        state.row = previous.row;
        state.audits = previous.audits;
        throw error;
      }
    },
  };
  const publisher = async (id: string, comment: unknown) => {
    assert.equal(id, runId);
    assert.equal(comment, text);
    assert.equal(state.row.status, "executing");
    state.publisherCalls++;
    if (state.publicationThrow) throw Error("synthetic provider uncertainty");
    if (state.receiptMode !== "missing")
      state.row.input.reviewPublication = {
        source: state.row.input.source,
        reviewId,
        attemptId,
        replyHash: digest(text),
        targetHash: target.fingerprint,
        at: now,
        state: state.receiptMode,
        ...(state.receiptMode === "confirmed" ? { confirmedAt: now } : {}),
      };
    state.receiptMutator(object(state.row.input.reviewPublication));
    return state.receiptMode === "confirmed" || state.receiptMode === "missing"
      ? {
          ok: true,
          runId,
          source: state.row.input.source,
          reviewId,
          replayed: false,
          confirmedAt: now,
        }
      : { ok: false, code: "source_unconfirmed" };
  };
  const deps = {
    database: db,
    hasFeature: async (tenant: string) => {
      assert.equal(tenant, clientId);
      return state.entitled;
    },
    publisher,
    resolveTarget: async () => clone(state.target),
    now: () => new Date(now),
  };
  const imports: Record<string, unknown> = {
    "server-only": {},
    "@prisma/client": { Prisma: { AnyNull: null, JsonNull: null } },
    "@/lib/billing/growth/entitlements": {
      clientHasGrowthFeature: deps.hasFeature,
    },
    "@/lib/db/prisma": {
      getPrisma: () => {
        throw Error("test database must be injected");
      },
    },
    "@/lib/qmaps/bridge": {
      QMAPS_BUSINESS_ID:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    "./review-target": {
      canonicalReviewReply,
      reviewReplyHash: digest,
      resolveReviewTarget: deps.resolveTarget,
    },
    "./review-target-model": { canonicalReviewReply },
    "./review-approval-service": { reviewDraftVersionHash: version },
    "./review-publisher": { publishReviewRunReply: publisher },
  };
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  assert.equal(
    compiled.diagnostics?.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
  );
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(
    compiled.outputText,
    {
      module,
      exports: module.exports,
      Date,
      console,
      require: (name: string) => {
        assert.ok(
          Object.hasOwn(imports, name),
          `Unexpected dependency: ${name}`,
        );
        return imports[name];
      },
      fetch: () => {
        throw Error("Tests must never reach a provider");
      },
    },
    { filename },
  );
  const publish = module.exports.publishApprovedReviewDraft as Publish;
  assert.equal(typeof publish, "function");
  const hash = () =>
    version(
      state.row.updatedAt,
      canonicalReviewReply(
        state.row.input.source as "google",
        object(state.row.input.reviewApproval).replyText,
      ),
      state.row.input,
    );
  return {
    state,
    deps,
    hash,
    call: (
      client = clientId,
      actor = actorId,
      run = runId,
      expected = hash(),
    ) => publish(client, actor, run, expected, deps),
  };
}

let count = 0;
async function check(name: string, test: () => Promise<void>) {
  await test();
  count++;
  console.log("PASS", name);
}
async function main() {
  await check(
    "native publication uses exact scoped approved text and confirmed receipt before completion",
    async () => {
      const f = fixture();
      const result = await f.call();
      assert.equal(result.ok, true);
      assert.equal(f.state.publisherCalls, 1);
      assert.equal(f.state.row.status, "completed");
      const claim = f.state.queryCalls.find((q) => q.kind === "update")!
        .args as Query;
      assert.equal(claim.where.clientId, clientId);
      assert.equal(claim.where.agentKey, "review_responder");
      assert.equal(claim.where.status, "approved");
      assert.ok(claim.where.updatedAt);
      assert.ok(object(claim.where.input).equals);
      assert.ok(object(claim.where.output).equals);
      assert.equal(
        object(f.state.row.input.reviewPublication).state,
        "confirmed",
      );
      assert.ok(f.state.audits.length >= 1);
      assert.ok(
        !JSON.stringify(f.state.audits).includes(text),
        "audit must not contain cleartext reply",
      );
    },
  );
  for (const [name, change] of [
    [
      "foreign tenant",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.clientId = foreignId;
      },
    ],
    [
      "wrong agent",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.agentKey = "other_agent";
      },
    ],
    [
      "unapproved run",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.status = "awaiting_approval";
      },
    ],
    [
      "executing worker",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.status = "executing";
      },
    ],
    [
      "legacy run",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.input.reviewWorkflowVersion = 1;
      },
    ],
    [
      "internal followup",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.input.source = "takatak";
      },
    ],
    [
      "expired plan",
      (f: ReturnType<typeof fixture>) => {
        f.state.entitled = false;
      },
    ],
    [
      "disabled agent",
      (f: ReturnType<typeof fixture>) => {
        f.state.enabled = false;
      },
    ],
    [
      "missing source",
      (f: ReturnType<typeof fixture>) => {
        f.state.target = null;
      },
    ],
    [
      "changed source",
      (f: ReturnType<typeof fixture>) => {
        f.state.target!.fingerprint = digest("newsource");
      },
    ],
    [
      "invalid approval",
      (f: ReturnType<typeof fixture>) => {
        object(f.state.row.input.reviewApproval).replyHash =
          digest("different reply");
      },
    ],
    [
      "changed output",
      (f: ReturnType<typeof fixture>) => {
        f.state.row.output!.reply = "Different output";
      },
    ],
  ] as const)
    await check(`${name} cannot call publisher`, async () => {
      const f = fixture();
      change(f);
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 0);
    });
  await check(
    "invalid identity and stale displayed version do not call publisher",
    async () => {
      const f = fixture();
      for (const args of [
        ["bad", actorId, runId, f.hash()],
        [clientId, "bad", runId, f.hash()],
        [clientId, actorId, "bad", f.hash()],
        [clientId, actorId, runId, digest("stale")],
      ])
        assert.equal(
          (await f.call(...(args as [string, string, string, string]))).ok,
          false,
        );
      assert.equal(f.state.publisherCalls, 0);
    },
  );
  await check(
    "external worker winning approved claim prevents native publisher call",
    async () => {
      const f = fixture();
      f.state.claimRace = true;
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 0);
    },
  );
  await check(
    "audit failure rolls back initial claim before any provider call",
    async () => {
      const f = fixture();
      f.state.auditError = true;
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 0);
      assert.equal(f.state.row.status, "approved");
    },
  );
  await check(
    "provider success without durable confirmed receipt cannot complete publication",
    async () => {
      const f = fixture();
      f.state.receiptMode = "missing";
      assert.equal((await f.call()).ok, false);
      assert.notEqual(f.state.row.status, "completed");
    },
  );
  await check(
    "uncertain source is preserved and never blindly sent twice",
    async () => {
      const f = fixture();
      f.state.receiptMode = "uncertain";
      assert.equal((await f.call()).ok, false);
      assert.notEqual(f.state.row.status, "completed");
      assert.equal(
        object(f.state.row.input.reviewPublication).state,
        "uncertain",
      );
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "publisher exception leaves publication unconfirmed and cannot resend",
    async () => {
      const f = fixture();
      f.state.publicationThrow = true;
      assert.equal((await f.call()).ok, false);
      assert.notEqual(f.state.row.status, "completed");
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "terminal completion CAS loss does not overwrite concurrent state or resend",
    async () => {
      const f = fixture();
      f.state.terminalRace = true;
      const result = await f.call();
      assert.equal(result.ok, false);
      assert.notEqual(f.state.row.status, "completed");
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "confirmed receipt repeat reconciles without another source request",
    async () => {
      const f = fixture();
      assert.equal((await f.call()).ok, true);
      const result = await f.call();
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.replayed, true);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "source-bound QMAPS approval uses the same explicit publication path",
    async () => {
      const f = fixture();
      f.state.row.input.source = "qmaps";
      f.state.target!.source = "qmaps";
      assert.equal((await f.call()).ok, true);
      assert.equal(f.state.row.status, "completed");
      assert.equal(object(f.state.row.input.reviewPublication).source, "qmaps");
    },
  );
  for (const [name, mutate] of [
    [
      "different source",
      (receipt: Record<string, unknown>) => {
        receipt.source = "qmaps";
      },
    ],
    [
      "different review",
      (receipt: Record<string, unknown>) => {
        receipt.reviewId = foreignId;
      },
    ],
    [
      "different reply",
      (receipt: Record<string, unknown>) => {
        receipt.replyHash = digest("foreign-reply");
      },
    ],
    [
      "different target",
      (receipt: Record<string, unknown>) => {
        receipt.targetHash = digest("foreign-target");
      },
    ],
    [
      "invalid attempt",
      (receipt: Record<string, unknown>) => {
        receipt.attemptId = "invalid";
      },
    ],
    [
      "invalid timestamp",
      (receipt: Record<string, unknown>) => {
        receipt.confirmedAt = "not-a-date";
      },
    ],
    [
      "confirmation before send",
      (receipt: Record<string, unknown>) => {
        receipt.confirmedAt = "2026-11-05T12:00:00.000Z";
      },
    ],
  ] as const)
    await check(`${name} receipt cannot prove publication`, async () => {
      const f = fixture();
      f.state.receiptMutator = mutate;
      assert.equal((await f.call()).ok, false);
      assert.notEqual(f.state.row.status, "completed");
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 1);
    });
  await check(
    "not configured receipt remains unconfirmed and cannot blindly resend",
    async () => {
      const f = fixture();
      f.state.receiptMode = "not_sent";
      assert.equal((await f.call()).ok, false);
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 1);
      assert.equal(
        object(f.state.row.input.reviewPublication).state,
        "not_sent",
      );
    },
  );
  await check(
    "completion storage error preserves source proof and reconciles without resend",
    async () => {
      const f = fixture();
      f.state.terminalError = true;
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.row.status, "executing");
      assert.equal(
        object(f.state.row.input.reviewPublication).state,
        "confirmed",
      );
      assert.equal((await f.call()).ok, true);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "native request marker prevents reusing an approval after failed send",
    async () => {
      const f = fixture();
      f.state.publicationThrow = true;
      assert.equal((await f.call()).ok, false);
      f.state.row.status = "approved";
      assert.equal((await f.call()).ok, false);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "server output summary does not erase durable confirmed receipt",
    async () => {
      const f = fixture();
      assert.equal((await f.call()).ok, true);
      f.state.row.output = { summary: "Synthetic worker finished" };
      const result = await f.call();
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.replayed, true);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  await check(
    "null worker output preserves bound confirmed replay",
    async () => {
      const f = fixture();
      assert.equal((await f.call()).ok, true);
      f.state.row.output = null;
      const result = await f.call();
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.replayed, true);
      assert.equal(f.state.publisherCalls, 1);
    },
  );
  for (const field of ["targetHash", "replyHash"] as const)
    await check(
      `prior confirmed receipt with mismatched ${field} is refused`,
      async () => {
        const f = fixture();
        assert.equal((await f.call()).ok, true);
        object(f.state.row.input.reviewPublication)[field] =
          digest("unbound receipt");
        assert.equal((await f.call()).ok, false);
        assert.equal(f.state.publisherCalls, 1);
      },
    );
  console.log(`${count} native Review publication checks passed`);
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
