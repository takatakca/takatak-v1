import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const clientId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const foreignId = "99999999-9999-4999-8999-999999999999";
const draftHash = "a".repeat(64);
const paths = ["/dashboard/growth/reviews", "/dashboard/growth/ai-engine"];
type State =
  { ok: null } | { ok: false; error: string } | { ok: true; message: string };
type Action = (previous: State, form: FormData) => Promise<State>;
const filename = resolve(
  "src/app/dashboard/growth/reviews/review-draft-actions.ts",
);
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
    (item) => item.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
);

function fixture() {
  const state = {
    access: {
      mode: "client_scoped",
      activeClientId: clientId,
      profileId,
    },
    permissions: new Set(["manage_reputation"]),
    features: new Set(["reputation", "ai_autopilot"]),
    featureCalls: [] as unknown[][],
    calls: [] as unknown[][],
    revalidated: [] as string[],
    result: { ok: true, runId, replayed: false, creditsDebited: 1 } as
      | { ok: true; runId: string; replayed: boolean; creditsDebited: number }
      | { ok: false; code: string },
    failAt: null as
      "auth" | "permission" | "feature" | "service" | "cache" | null,
  };
  const privateError = "SYNTHETIC_PRIVATE_GENERATION_DETAIL";
  const fail = (at: typeof state.failAt) => {
    if (state.failAt === at) throw new Error(privateError);
  };
  const forbidden = () => {
    throw new Error("Generation action must not edit, approve or publish");
  };
  const dependencies: Record<string, unknown> = {
    "next/cache": {
      revalidatePath: (path: string) => {
        state.revalidated.push(path);
        fail("cache");
      },
    },
    "@/lib/security/access-context": {
      getServerAccessContext: async () => {
        fail("auth");
        return { access: state.access };
      },
    },
    "@/lib/security/effective-permissions": {
      hasEffectivePermission: (access: unknown, permission: string) => {
        assert.equal(access, state.access);
        fail("permission");
        return state.permissions.has(permission);
      },
    },
    "@/lib/billing/growth/entitlements": {
      clientHasGrowthFeature: async (...args: unknown[]) => {
        state.featureCalls.push(args);
        fail("feature");
        assert.equal(args[0], state.access.activeClientId);
        return state.features.has(String(args[1]));
      },
      FEATURE_UPSELL: {
        reputation: "Synthetic reputation plan required",
        ai_autopilot: "Synthetic AI plan required",
      },
    },
    "@/lib/reputation/review-approval-service": {
      saveReviewDraft: forbidden,
      decideReviewDraft: forbidden,
    },
    "@/lib/reputation/review-generation": {
      generateReviewRunDraft: async (...args: unknown[]) => {
        state.calls.push(args);
        fail("service");
        return state.result;
      },
    },
    "@/lib/reputation/review-native-publication": {
      publishApprovedReviewDraft: async (...args: unknown[]) => {
        state.calls.push(args);
        fail("service");
        return state.result;
      },
    },
  };
  const actionModule = { exports: {} as Record<string, unknown> };
  runInNewContext(
    compiled.outputText,
    {
      module: actionModule,
      exports: actionModule.exports,
      require: (name: string) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected module ${name}`,
        );
        return dependencies[name];
      },
      fetch: () => {
        throw new Error("Synthetic action tests cannot reach the network");
      },
    },
    { filename },
  );
  assert.equal(
    typeof actionModule.exports.generateReviewDraftAction,
    "function",
  );
  assert.equal(
    typeof actionModule.exports.publishReviewDraftAction,
    "function",
  );
  return {
    state,
    privateError,
    action: actionModule.exports.generateReviewDraftAction as Action,
    publicationAction: actionModule.exports.publishReviewDraftAction as Action,
  };
}
function form() {
  const value = new FormData();
  value.set("runId", runId);
  return value;
}
function refused(value: State) {
  assert.equal(value.ok, false);
  if (value.ok !== false) throw new Error("Expected refusal");
  assert.ok(value.error.length > 0);
  return value.error;
}
const tests: Array<[string, () => Promise<void>]> = [
  [
    "every non-client session is denied before generation or credit operations",
    async () => {
      for (const mode of [
        "denied",
        "foundation_demo",
        "platform_admin",
        "selection_required",
      ]) {
        const { state, action } = fixture();
        state.access.mode = mode;
        refused(await action({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
        assert.equal(state.featureCalls.length, 0);
        assert.equal(state.revalidated.length, 0);
      }
    },
  ],
  [
    "reputation management permission is checked independently of approval permission",
    async () => {
      for (const permissions of [
        [],
        ["approve_content"],
        ["view_reputation"],
      ]) {
        const { state, action } = fixture();
        state.permissions = new Set(permissions);
        refused(await action({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
        assert.equal(state.featureCalls.length, 0);
      }
      const { state, action } = fixture();
      assert.equal((await action({ ok: null }, form())).ok, true);
      assert.deepEqual(state.calls, [[clientId, profileId, runId]]);
    },
  ],
  [
    "workspace and actor come from the current session despite forged form and previous state",
    async () => {
      const { state, action } = fixture();
      const data = form();
      for (const key of [
        "clientId",
        "activeClientId",
        "profileId",
        "source",
        "reviewId",
      ])
        data.set(key, foreignId);
      data.set("reply", "Forged provider output");
      const result = await action({ ok: true, message: foreignId }, data);
      assert.equal(result.ok, true);
      if (result.ok) assert.match(result.message, /approuv/i);
      assert.deepEqual(state.calls, [[clientId, profileId, runId]]);
      assert.deepEqual(state.revalidated, paths);
    },
  ],
  [
    "both reputation and AI feature access are required before the native service",
    async () => {
      for (const feature of ["reputation", "ai_autopilot"]) {
        const { state, action } = fixture();
        state.features.delete(feature);
        refused(await action({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
        assert.equal(state.revalidated.length, 0);
      }
    },
  ],
  [
    "service refusals are returned without claiming generation or refreshing saved state",
    async () => {
      const { state, action } = fixture();
      state.result = { ok: false, code: "SYNTHETIC_PRIVATE_LEASE_CODE" };
      const error = refused(await action({ ok: null }, form()));
      assert.ok(!error.includes(state.result.code));
      assert.deepEqual(state.calls, [[clientId, profileId, runId]]);
      assert.equal(state.revalidated.length, 0);
    },
  ],
  [
    "known readiness, credit and provider refusals return operator guidance without raw service data",
    async () => {
      for (const code of [
        "not_configured",
        "insufficient_credits",
        "daily_limit",
        "review_changed",
        "agent_disabled",
        "provider_failed",
        "generation_uncertain",
      ]) {
        const { state, action } = fixture();
        state.result = { ok: false, code };
        const message = refused(await action({ ok: null }, form()));
        assert.ok(!message.includes(code));
        assert.equal(state.calls.length, 1);
        assert.equal(state.revalidated.length, 0);
      }
    },
  ],
  [
    "a missing run reference cannot inject an alternative review or provider payload",
    async () => {
      const { state, action } = fixture();
      state.result = { ok: false, code: "invalid_request" };
      const data = new FormData();
      data.set("reviewId", foreignId);
      data.set("output", "Forged content");
      refused(await action({ ok: null }, data));
      assert.deepEqual(state.calls, [[clientId, profileId, ""]]);
      assert.equal(state.revalidated.length, 0);
    },
  ],
  [
    "authority, entitlement and persistence failures return bounded recoverable errors",
    async () => {
      for (const failAt of [
        "auth",
        "permission",
        "feature",
        "service",
      ] as const) {
        const { state, action, privateError } = fixture();
        state.failAt = failAt;
        const message = refused(await action({ ok: null }, form()));
        assert.ok(!message.includes(privateError));
        assert.equal(state.calls.length, failAt === "service" ? 1 : 0);
        assert.equal(state.revalidated.length, 0);
      }
    },
  ],
  [
    "a refresh failure after persistence never exposes server internals",
    async () => {
      const { state, action, privateError } = fixture();
      state.failAt = "cache";
      assert.ok(
        !refused(await action({ ok: null }, form())).includes(privateError),
      );
      assert.equal(state.calls.length, 1);
      assert.deepEqual(state.revalidated, [paths[0]]);
    },
  ],
  [
    "repeated calls re-evaluate active workspace and permissions",
    async () => {
      const { state, action } = fixture();
      await action({ ok: null }, form());
      state.access.activeClientId = foreignId;
      state.permissions.clear();
      refused(await action({ ok: null }, form()));
      assert.deepEqual(state.calls, [[clientId, profileId, runId]]);
    },
  ],
  [
    "direct publication requires both management and approval permissions and a client session",
    async () => {
      for (const permissions of [
        [],
        ["manage_reputation"],
        ["approve_content"],
      ]) {
        const { state, publicationAction } = fixture();
        state.permissions = new Set(permissions);
        refused(await publicationAction({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
        assert.equal(state.featureCalls.length, 0);
      }
      for (const mode of [
        "denied",
        "foundation_demo",
        "platform_admin",
        "selection_required",
      ]) {
        const { state, publicationAction } = fixture();
        state.permissions.add("approve_content");
        state.access.mode = mode;
        refused(await publicationAction({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
      }
    },
  ],
  [
    "publication forwards only session identity, exact run and displayed hash to the source-bound service",
    async () => {
      const { state, publicationAction } = fixture();
      state.permissions.add("approve_content");
      const data = form();
      data.set("expectedDraftHash", draftHash);
      for (const key of [
        "clientId",
        "profileId",
        "source",
        "reviewId",
        "approvedText",
      ])
        data.set(key, foreignId);
      const result = await publicationAction(
        { ok: true, message: foreignId },
        data,
      );
      assert.equal(result.ok, true);
      if (result.ok) assert.match(result.message, /confirmé/);
      assert.deepEqual(state.calls, [[clientId, profileId, runId, draftHash]]);
      assert.deepEqual(state.revalidated, paths);
    },
  ],
  [
    "both feature entitlements are rechecked before publication",
    async () => {
      for (const feature of ["reputation", "ai_autopilot"]) {
        const { state, publicationAction } = fixture();
        state.permissions.add("approve_content");
        state.features.delete(feature);
        refused(await publicationAction({ ok: null }, form()));
        assert.equal(state.calls.length, 0);
        assert.equal(state.revalidated.length, 0);
      }
    },
  ],
  [
    "publication refusal never claims a confirmed source response or leaks raw reasons",
    async () => {
      const { state, publicationAction } = fixture();
      state.permissions.add("approve_content");
      state.result = { ok: false, code: "SYNTHETIC_PRIVATE_PROVIDER_REASON" };
      const message = refused(await publicationAction({ ok: null }, form()));
      assert.ok(!message.includes(state.result.code));
      assert.equal(state.calls.length, 1);
      assert.equal(state.revalidated.length, 0);
    },
  ],
  [
    "publication authority, feature and source failures remain bounded without an automatic retry",
    async () => {
      for (const failAt of [
        "auth",
        "permission",
        "feature",
        "service",
        "cache",
      ] as const) {
        const { state, publicationAction, privateError } = fixture();
        state.permissions.add("approve_content");
        state.failAt = failAt;
        const message = refused(await publicationAction({ ok: null }, form()));
        assert.ok(!message.includes(privateError));
        assert.equal(
          state.calls.length,
          failAt === "service" || failAt === "cache" ? 1 : 0,
        );
        assert.deepEqual(
          state.revalidated,
          failAt === "cache" ? [paths[0]] : [],
        );
      }
    },
  ],
];
async function main() {
  for (const [name, check] of tests) {
    await check();
    console.log(`PASS ${name}`);
  }
  console.log(
    `Review generation and publication actions: ${tests.length} checks passed. Real exported actions, synthetic authority and services; no provider or credit operation.`,
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
