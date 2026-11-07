import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const tenant = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const foreign = "99999999-9999-4999-8999-999999999999";
const draftHash = "a".repeat(64);
const editedHash = "b".repeat(64);
const editedText =
  "Merci de votre visite. Nous avons transmis votre commentaire à l’équipe.";
const paths = ["/dashboard/growth/reviews", "/dashboard/growth/ai-engine"];
const upsell = "Synthetic plan requirement";
type State =
  | { ok: null }
  | { ok: false; error: string }
  | { ok: true; message: string; draft?: string; draftHash?: string };
type Action = (previous: State, form: FormData) => Promise<State>;
type Actions = {
  saveReviewDraftAction: Action;
  decideReviewDraftAction: Action;
};
type Call = { kind: "save" | "decide"; args: unknown[] };
type Scenario = {
  access: { mode: string; activeClientId: string; profileId: string };
  permissions: Set<string>;
  entitled: boolean;
  featureCalls: unknown[][];
  serviceCalls: Call[];
  revalidated: string[];
  saveResult: State;
  decisionResult: State;
  serviceError: Error | null;
  authorityError: Error | null;
  permissionError: Error | null;
  entitlementError: Error | null;
  cacheError: Error | null;
};

// Execute the whole real action module. Only its external authority, persistence
// and cache dependencies are substituted; no action body is copied into the test.
const filename = resolve(
  process.cwd(),
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
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
  "the action module must transpile before its behavior is exercised",
);

function fixture() {
  const scenario: Scenario = {
    access: { mode: "client_scoped", activeClientId: tenant, profileId: actor },
    permissions: new Set(["manage_reputation", "approve_content"]),
    entitled: true,
    featureCalls: [],
    serviceCalls: [],
    revalidated: [],
    saveResult: {
      ok: true,
      message: "Synthetic saved draft",
      draft: editedText,
      draftHash: editedHash,
    },
    decisionResult: { ok: true, message: "Synthetic stored decision" },
    serviceError: null,
    authorityError: null,
    permissionError: null,
    entitlementError: null,
    cacheError: null,
  };
  const dependencies: Record<string, unknown> = {
    "next/cache": {
      revalidatePath: (path: string) => {
        scenario.revalidated.push(path);
        if (scenario.cacheError) throw scenario.cacheError;
      },
    },
    "@/lib/billing/growth/entitlements": {
      clientHasGrowthFeature: async (...args: unknown[]) => {
        scenario.featureCalls.push(args);
        if (scenario.entitlementError) throw scenario.entitlementError;
        return scenario.entitled;
      },
      FEATURE_UPSELL: { ai_autopilot: upsell },
    },
    "@/lib/security/access-context": {
      getServerAccessContext: async () => {
        if (scenario.authorityError) throw scenario.authorityError;
        return { access: scenario.access };
      },
    },
    "@/lib/security/effective-permissions": {
      hasEffectivePermission: (access: unknown, permission: string) => {
        assert.equal(access, scenario.access);
        if (scenario.permissionError) throw scenario.permissionError;
        return scenario.permissions.has(permission);
      },
    },
    "@/lib/reputation/review-approval-service": {
      saveReviewDraft: async (...args: unknown[]) => {
        scenario.serviceCalls.push({ kind: "save", args });
        if (scenario.serviceError) throw scenario.serviceError;
        return scenario.saveResult;
      },
      decideReviewDraft: async (...args: unknown[]) => {
        scenario.serviceCalls.push({ kind: "decide", args });
        if (scenario.serviceError) throw scenario.serviceError;
        return scenario.decisionResult;
      },
    },
    "@/lib/reputation/review-generation": {
      generateReviewRunDraft: async () => {
        throw new Error("Draft edit/decision tests must not generate content");
      },
    },
    "@/lib/reputation/review-native-publication": {
      publishApprovedReviewDraft: async () => {
        throw new Error("Draft edit/decision tests must not publish content");
      },
    },
  };
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(
    compiled.outputText,
    {
      module,
      exports: module.exports,
      require: (name: string) => {
        assert.ok(
          Object.hasOwn(dependencies, name),
          `Unexpected unstubbed dependency: ${name}`,
        );
        return dependencies[name];
      },
      fetch: () => {
        throw new Error("Action tests must never reach a provider or network");
      },
    },
    { filename },
  );
  assert.equal(typeof module.exports.saveReviewDraftAction, "function");
  assert.equal(typeof module.exports.decideReviewDraftAction, "function");
  return { scenario, actions: module.exports as unknown as Actions };
}

function form(decision = "approve"): FormData {
  const data = new FormData();
  data.set("runId", runId);
  data.set("expectedDraftHash", draftHash);
  data.set("replyText", editedText);
  data.set("decision", decision);
  return data;
}
function refused(result: State) {
  assert.equal(result.ok, false);
  if (result.ok !== false) throw new Error("Expected a refused action");
  assert.ok(result.error.length > 0);
  return result.error;
}
function noMutation(scenario: Scenario) {
  assert.equal(scenario.serviceCalls.length, 0);
  assert.equal(scenario.revalidated.length, 0);
}
const tests: Array<[string, () => Promise<void>]> = [
  [
    "non-client sessions cannot invoke edit, approve or reject even with matching permission names",
    async () => {
      for (const mode of [
        "denied",
        "foundation_demo",
        "platform_admin",
        "selection_required",
      ]) {
        const { scenario, actions } = fixture();
        scenario.access.mode = mode;
        refused(await actions.saveReviewDraftAction({ ok: null }, form()));
        refused(await actions.decideReviewDraftAction({ ok: null }, form()));
        refused(
          await actions.decideReviewDraftAction({ ok: null }, form("reject")),
        );
        noMutation(scenario);
        assert.equal(scenario.featureCalls.length, 0);
      }
    },
  ],
  [
    "both reputation management and content approval permissions are required on every direct action call",
    async () => {
      for (const permissions of [
        [],
        ["manage_reputation"],
        ["approve_content"],
      ]) {
        const { scenario, actions } = fixture();
        scenario.permissions = new Set(permissions);
        refused(await actions.saveReviewDraftAction({ ok: null }, form()));
        refused(await actions.decideReviewDraftAction({ ok: null }, form()));
        refused(
          await actions.decideReviewDraftAction({ ok: null }, form("reject")),
        );
        noMutation(scenario);
      }
    },
  ],
  [
    "edits use the current session tenant and actor despite submitted tenant, profile or prior-state injection",
    async () => {
      const { scenario, actions } = fixture();
      const data = form();
      data.set("clientId", foreign);
      data.set("activeClientId", foreign);
      data.set("profileId", foreign);
      data.set("source", "qmaps");
      const forgedPrevious = {
        ok: true,
        message: foreign,
        draft: foreign,
        draftHash: foreign,
      } as const;
      const result = await actions.saveReviewDraftAction(forgedPrevious, data);
      assert.equal(result, scenario.saveResult);
      assert.deepEqual(scenario.serviceCalls, [
        { kind: "save", args: [tenant, actor, runId, draftHash, editedText] },
      ]);
      assert.deepEqual(scenario.featureCalls, [[tenant, "ai_autopilot"]]);
      assert.deepEqual(scenario.revalidated, paths);
    },
  ],
  [
    "approval and rejection forward only session authority, exact run, decision and displayed version",
    async () => {
      for (const decision of ["approve", "reject"]) {
        const { scenario, actions } = fixture();
        const data = form(decision);
        data.set("clientId", foreign);
        data.set("profileId", foreign);
        data.set(
          "replyText",
          "A browser cannot replace the saved approved text through this action",
        );
        const result = await actions.decideReviewDraftAction(
          { ok: null },
          data,
        );
        assert.equal(result, scenario.decisionResult);
        assert.deepEqual(scenario.serviceCalls, [
          { kind: "decide", args: [tenant, actor, runId, decision, draftHash] },
        ]);
        assert.deepEqual(scenario.revalidated, paths);
      }
    },
  ],
  [
    "current entitlement is required for editing and approval before persistence or cache invalidation",
    async () => {
      const { scenario, actions } = fixture();
      scenario.entitled = false;
      assert.equal(
        refused(await actions.saveReviewDraftAction({ ok: null }, form())),
        upsell,
      );
      assert.equal(
        refused(await actions.decideReviewDraftAction({ ok: null }, form())),
        upsell,
      );
      noMutation(scenario);
      assert.deepEqual(scenario.featureCalls, [
        [tenant, "ai_autopilot"],
        [tenant, "ai_autopilot"],
      ]);
    },
  ],
  [
    "an authorized stop decision still works after paid entitlement expires",
    async () => {
      const { scenario, actions } = fixture();
      scenario.entitled = false;
      const result = await actions.decideReviewDraftAction(
        { ok: null },
        form("reject"),
      );
      assert.equal(result.ok, true);
      assert.equal(scenario.featureCalls.length, 0);
      assert.deepEqual(scenario.serviceCalls, [
        { kind: "decide", args: [tenant, actor, runId, "reject", draftHash] },
      ]);
      assert.deepEqual(scenario.revalidated, paths);
    },
  ],
  [
    "unknown, missing and uploaded-file decisions never become an approval or rejection",
    async () => {
      const invalidForms = [form("publish"), form("")];
      const missing = form();
      missing.delete("decision");
      invalidForms.push(missing);
      const file = form();
      file.set("decision", new Blob(["approve"]), "decision.txt");
      invalidForms.push(file);
      for (const data of invalidForms) {
        const { scenario, actions } = fixture();
        refused(await actions.decideReviewDraftAction({ ok: null }, data));
        noMutation(scenario);
        assert.equal(scenario.featureCalls.length, 0);
      }
    },
  ],
  [
    "missing or uploaded reply content is refused without coercing a file into saved text",
    async () => {
      const missing = form();
      missing.delete("replyText");
      const file = form();
      file.set("replyText", new Blob([editedText]), "review.txt");
      for (const data of [missing, file]) {
        const { scenario, actions } = fixture();
        refused(await actions.saveReviewDraftAction({ ok: null }, data));
        noMutation(scenario);
      }
    },
  ],
  [
    "source or version conflicts remain refused and do not trigger a success refresh",
    async () => {
      const { scenario, actions } = fixture();
      scenario.saveResult = { ok: false, error: "Synthetic stale draft" };
      scenario.decisionResult = {
        ok: false,
        error: "Synthetic already-decided run",
      };
      assert.equal(
        refused(await actions.saveReviewDraftAction({ ok: null }, form())),
        "Synthetic stale draft",
      );
      assert.equal(
        refused(await actions.decideReviewDraftAction({ ok: null }, form())),
        "Synthetic already-decided run",
      );
      assert.equal(scenario.serviceCalls.length, 2);
      assert.equal(scenario.revalidated.length, 0);
    },
  ],
  [
    "persistence failures return generic recoverable errors without exposing internal details or invalidating caches",
    async () => {
      const { scenario, actions } = fixture();
      scenario.serviceError = new Error("SYNTHETIC_PRIVATE_PERSISTENCE_DETAIL");
      const editError = refused(
        await actions.saveReviewDraftAction({ ok: null }, form()),
      );
      const decisionError = refused(
        await actions.decideReviewDraftAction({ ok: null }, form()),
      );
      assert.ok(!editError.includes(scenario.serviceError.message));
      assert.ok(!decisionError.includes(scenario.serviceError.message));
      assert.match(editError, /Conservez votre texte/);
      assert.equal(scenario.revalidated.length, 0);
    },
  ],
  [
    "unavailable session authority returns a generic state without invoking persistence or leaking details",
    async () => {
      const { scenario, actions } = fixture();
      scenario.authorityError = new Error("SYNTHETIC_PRIVATE_SESSION_FAILURE");
      for (const action of [
        actions.saveReviewDraftAction,
        actions.decideReviewDraftAction,
      ]) {
        const error = refused(await action({ ok: null }, form()));
        assert.ok(!error.includes(scenario.authorityError.message));
      }
      noMutation(scenario);
      assert.equal(scenario.featureCalls.length, 0);
    },
  ],
  [
    "permission resolution failures cannot escape the action state or reach the data service",
    async () => {
      const { scenario, actions } = fixture();
      scenario.permissionError = new Error(
        "SYNTHETIC_PRIVATE_PERMISSION_FAILURE",
      );
      for (const action of [
        actions.saveReviewDraftAction,
        actions.decideReviewDraftAction,
      ]) {
        const error = refused(await action({ ok: null }, form()));
        assert.ok(!error.includes(scenario.permissionError.message));
      }
      noMutation(scenario);
      assert.equal(scenario.featureCalls.length, 0);
    },
  ],
  [
    "an unavailable entitlement lookup preserves a generic recoverable response and never starts a save or approval",
    async () => {
      const { scenario, actions } = fixture();
      scenario.entitlementError = new Error(
        "SYNTHETIC_PRIVATE_ENTITLEMENT_FAILURE",
      );
      for (const action of [
        actions.saveReviewDraftAction,
        actions.decideReviewDraftAction,
      ]) {
        const error = refused(await action({ ok: null }, form()));
        assert.ok(!error.includes(scenario.entitlementError.message));
      }
      noMutation(scenario);
      assert.deepEqual(scenario.featureCalls, [
        [tenant, "ai_autopilot"],
        [tenant, "ai_autopilot"],
      ]);
    },
  ],
  [
    "a cache refresh failure after persistence returns an explicit state instead of an unhandled exception or internal error",
    async () => {
      for (const kind of ["save", "decide"] as const) {
        const { scenario, actions } = fixture();
        scenario.cacheError = new Error("SYNTHETIC_PRIVATE_CACHE_FAILURE");
        const action =
          kind === "save"
            ? actions.saveReviewDraftAction
            : actions.decideReviewDraftAction;
        const error = refused(await action({ ok: null }, form()));
        assert.ok(!error.includes(scenario.cacheError.message));
        assert.equal(scenario.serviceCalls.length, 1);
        assert.equal(scenario.serviceCalls[0].kind, kind);
        assert.deepEqual(scenario.revalidated, [paths[0]]);
      }
    },
  ],
  [
    "authority is checked again on repeated calls rather than retained after a successful edit",
    async () => {
      const { scenario, actions } = fixture();
      assert.equal(
        (await actions.saveReviewDraftAction({ ok: null }, form())).ok,
        true,
      );
      scenario.permissions.delete("approve_content");
      refused(await actions.saveReviewDraftAction({ ok: null }, form()));
      refused(await actions.decideReviewDraftAction({ ok: null }, form()));
      assert.equal(scenario.serviceCalls.length, 1);
      assert.deepEqual(scenario.revalidated, paths);
    },
  ],
];

async function main() {
  for (const [name, check] of tests) {
    await check();
    console.log(`PASS ${name}`);
  }
  console.log(
    `Review draft actions: ${tests.length} checks passed. Actual exported actions with synthetic authority/persistence/cache dependencies; no provider, credit debit or production database operation.`,
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
