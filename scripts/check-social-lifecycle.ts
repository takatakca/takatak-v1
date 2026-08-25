/**
 * Social connection lifecycle matrix tests.
 * Covers every registry provider and lifecycle action, including
 * continue_authorization attempt states and add_another_account rules.
 * Exit 1 on any mismatch. Never prints tokens/secrets.
 */
import * as lifecyclePolicy from "../src/lib/social/connections/social-connection-lifecycle-policy";
import {
  canAddAnotherAccount,
  canCancelPendingConnection,
  canContinueAuthorization,
  canDisconnectConnection,
  canStartProviderConnect,
  connectionMatchesProviderScope,
  evaluateOAuthAttemptForContinue,
  META_PLATFORM_REPRESENTATION,
  resolveProviderCardLabel,
} from "../src/lib/social/connections/social-connection-lifecycle-policy";

type ProviderFixture = {
  provider: string;
  implemented: boolean;
  connectable: boolean;
  supportsMultipleAccounts: boolean;
  providerState:
    | "planned"
    | "not_configured"
    | "ready_for_authorization";
};

const PROVIDERS: ProviderFixture[] = [
  {
    provider: "meta",
    implemented: true,
    connectable: true,
    supportsMultipleAccounts: true,
    providerState: "ready_for_authorization",
  },
  {
    provider: "google",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "linkedin",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "tiktok",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "pinterest",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "x",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "bluesky",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
  {
    provider: "twitch",
    implemented: false,
    connectable: false,
    supportsMultipleAccounts: false,
    providerState: "planned",
  },
];

const STATUSES = [
  "not_connected",
  "pending_authorization",
  "authorized",
  "connected",
  "reauthorization_required",
  "disconnected",
  "failed",
  "expired",
  "error",
  "disabled",
] as const;

type Case = {
  name: string;
  pass: boolean;
  detail?: string;
};

const cases: Case[] = [];

function assert(
  name: string,
  condition: boolean,
  detail?: string,
) {
  cases.push({
    name,
    pass: condition,
    detail: condition
      ? undefined
      : detail ?? "assertion failed",
  });
}

const now = new Date("2026-08-11T12:00:00.000Z");
const future = new Date("2026-08-11T12:05:00.000Z");
const past = new Date("2026-08-11T11:50:00.000Z");

for (const provider of PROVIDERS) {
  const startIdle = canStartProviderConnect({
    implemented: provider.implemented,
    connectable: provider.connectable,
    providerState: provider.providerState,
    connectionStatus: null,
    isPrimaryStartCard: true,
  });

  if (provider.implemented) {
    assert(
      `${provider.provider}/start_connect/idle → allowed`,
      startIdle.allowed === true,
      JSON.stringify(startIdle),
    );
  } else {
    assert(
      `${provider.provider}/start_connect/idle → coming_soon (no auth records)`,
      startIdle.allowed === false &&
        startIdle.reason === "coming_soon",
      JSON.stringify(startIdle),
    );
  }

  for (const status of STATUSES) {
    const start = canStartProviderConnect({
      implemented: provider.implemented,
      connectable: provider.connectable,
      providerState: provider.providerState,
      connectionStatus: status,
      isPrimaryStartCard: true,
    });

    const cancel = canCancelPendingConnection(status);
    const disconnect = canDisconnectConnection(status);
    const cont = canContinueAuthorization({
      implemented: provider.implemented,
      connectable: provider.connectable,
      providerState: provider.providerState,
      connectionStatus: status,
      isPrimaryStartCard: true,
    });
    const add = canAddAnotherAccount({
      implemented: provider.implemented,
      connectable: provider.connectable,
      providerState: provider.providerState,
      supportsMultipleAccounts:
        provider.supportsMultipleAccounts,
      sourceConnectionStatus: status,
      isPrimaryStartCard: true,
      hasPendingForProviderBrand: false,
    });

    if (!provider.implemented) {
      assert(
        `${provider.provider}/start_connect/${status} → blocked`,
        start.allowed === false,
        JSON.stringify(start),
      );
      assert(
        `${provider.provider}/continue_authorization/${status} → coming_soon`,
        cont.allowed === false &&
          cont.reason === "coming_soon",
        JSON.stringify(cont),
      );
      assert(
        `${provider.provider}/add_another_account/${status} → coming_soon`,
        add.allowed === false &&
          add.reason === "coming_soon",
        JSON.stringify(add),
      );
    } else {
      if (
        status === "connected" ||
        status === "authorized" ||
        status === "pending_authorization"
      ) {
        assert(
          `${provider.provider}/start_connect/${status} → blocked`,
          start.allowed === false,
          JSON.stringify(start),
        );
      } else if (status !== "disabled") {
        assert(
          `${provider.provider}/start_connect/${status} → allowed`,
          start.allowed === true,
          JSON.stringify(start),
        );
      }

      if (status === "pending_authorization") {
        assert(
          `${provider.provider}/continue_authorization/${status} → allowed`,
          cont.allowed === true,
          JSON.stringify(cont),
        );
      } else {
        assert(
          `${provider.provider}/continue_authorization/${status} → blocked`,
          cont.allowed === false,
          JSON.stringify(cont),
        );
      }

      if (
        provider.supportsMultipleAccounts &&
        (status === "authorized" || status === "connected")
      ) {
        assert(
          `${provider.provider}/add_another_account/${status} → allowed`,
          add.allowed === true,
          JSON.stringify(add),
        );
      } else if (!provider.supportsMultipleAccounts) {
        assert(
          `${provider.provider}/add_another_account/${status} → unsupported`,
          add.allowed === false &&
            add.reason === "multiple_accounts_unsupported",
          JSON.stringify(add),
        );
      } else {
        assert(
          `${provider.provider}/add_another_account/${status} → blocked`,
          add.allowed === false,
          JSON.stringify(add),
        );
      }
    }

    if (status === "pending_authorization") {
      assert(
        `${provider.provider}/cancel_pending/${status} → allowed`,
        cancel.allowed === true,
        JSON.stringify(cancel),
      );
    } else if (
      status === "authorized" ||
      status === "connected"
    ) {
      assert(
        `${provider.provider}/cancel_pending/${status} → NEVER mutates live`,
        cancel.allowed === false,
        JSON.stringify(cancel),
      );
    } else {
      assert(
        `${provider.provider}/cancel_pending/${status} → blocked`,
        cancel.allowed === false,
        JSON.stringify(cancel),
      );
    }

    if (status === "pending_authorization") {
      assert(
        `${provider.provider}/disconnect/${status} → use cancel-pending`,
        disconnect.allowed === false,
        JSON.stringify(disconnect),
      );
    } else if (
      status === "not_connected" ||
      status === "disabled"
    ) {
      assert(
        `${provider.provider}/disconnect/${status} → blocked`,
        disconnect.allowed === false,
        JSON.stringify(disconnect),
      );
    } else {
      assert(
        `${provider.provider}/disconnect/${status} → allowed`,
        disconnect.allowed === true,
        JSON.stringify(disconnect),
      );
    }
  }

  // concurrent pending blocks add-another even when source is live
  if (provider.implemented && provider.supportsMultipleAccounts) {
    const blockedByPending = canAddAnotherAccount({
      implemented: true,
      connectable: true,
      providerState: "ready_for_authorization",
      supportsMultipleAccounts: true,
      sourceConnectionStatus: "connected",
      isPrimaryStartCard: true,
      hasPendingForProviderBrand: true,
    });

    assert(
      `${provider.provider}/add_another_account/concurrent_pending → blocked`,
      blockedByPending.allowed === false,
      JSON.stringify(blockedByPending),
    );
  }

  assert(
    `${provider.provider}/scope/match`,
    connectionMatchesProviderScope({
      connectionProvider: provider.provider,
      expectedProvider: provider.provider,
    }).allowed === true,
  );

  assert(
    `${provider.provider}/scope/mismatch → cross-provider blocked`,
    connectionMatchesProviderScope({
      connectionProvider: provider.provider,
      expectedProvider: "other",
    }).allowed === false,
  );

  if (provider.implemented) {
    const secondary = canStartProviderConnect({
      implemented: true,
      connectable: true,
      providerState: "ready_for_authorization",
      connectionStatus: null,
      isPrimaryStartCard: false,
    });

    assert(
      `${provider.provider}/start_connect/secondary_card → blocked`,
      secondary.allowed === false &&
        secondary.reason === "not_primary_card",
      JSON.stringify(secondary),
    );

    const continueSecondary = canContinueAuthorization({
      implemented: true,
      connectable: true,
      providerState: "ready_for_authorization",
      connectionStatus: "pending_authorization",
      isPrimaryStartCard: false,
    });

    assert(
      `${provider.provider}/continue_authorization/secondary_card → blocked`,
      continueSecondary.allowed === false,
      JSON.stringify(continueSecondary),
    );
  }
}

// --- continue attempt evaluation (valid / expired / consumed / concurrent) ---
assert(
  "shared/continue_attempt/valid → resume",
  evaluateOAuthAttemptForContinue(
    {
      status: "pending",
      expiresAt: future,
      consumedAt: null,
      hasAuthorizationUrl: true,
    },
    now,
  ).kind === "resume",
);

assert(
  "shared/continue_attempt/expired → refresh",
  (() => {
    const d = evaluateOAuthAttemptForContinue(
      {
        status: "pending",
        expiresAt: past,
        consumedAt: null,
        hasAuthorizationUrl: true,
      },
      now,
    );
    return d.kind === "refresh" && d.reason === "expired";
  })(),
);

assert(
  "shared/continue_attempt/consumed → refresh",
  (() => {
    const d = evaluateOAuthAttemptForContinue(
      {
        status: "completed",
        expiresAt: future,
        consumedAt: past,
        hasAuthorizationUrl: true,
      },
      now,
    );
    return d.kind === "refresh" && d.reason === "consumed";
  })(),
);

assert(
  "shared/continue_attempt/missing_url → refresh",
  (() => {
    const d = evaluateOAuthAttemptForContinue(
      {
        status: "pending",
        expiresAt: future,
        consumedAt: null,
        hasAuthorizationUrl: false,
      },
      now,
    );
    return (
      d.kind === "refresh" &&
      d.reason === "missing_authorization_url"
    );
  })(),
);

assert(
  "shared/continue_attempt/processing_concurrent → blocked",
  (() => {
    const d = evaluateOAuthAttemptForContinue(
      {
        status: "processing",
        expiresAt: future,
        consumedAt: null,
        hasAuthorizationUrl: true,
      },
      now,
    );
    return (
      d.kind === "blocked" &&
      d.reason === "authorization_in_progress"
    );
  })(),
);

assert(
  "shared/continue_attempt/missing → refresh",
  evaluateOAuthAttemptForContinue(null, now).kind ===
    "refresh",
);

assert(
  "shared/continue_attempt/cancelled_unusable → refresh",
  (() => {
    const d = evaluateOAuthAttemptForContinue(
      {
        status: "cancelled",
        expiresAt: future,
        consumedAt: past,
        hasAuthorizationUrl: true,
      },
      now,
    );
    return d.kind === "refresh";
  })(),
);

// unauthorized / permission surface is API-gated; policy still scopes actions
assert(
  "shared/unauthorized/continue_non_pending → blocked",
  canContinueAuthorization({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: "connected",
    isPrimaryStartCard: true,
  }).allowed === false,
);

assert(
  "shared/unauthorized/add_another_from_pending → blocked",
  canAddAnotherAccount({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    supportsMultipleAccounts: true,
    sourceConnectionStatus: "pending_authorization",
    isPrimaryStartCard: true,
    hasPendingForProviderBrand: false,
  }).allowed === false,
);

// Meta platform representation clarity
for (const platform of [
  "facebook",
  "instagram",
  "threads",
] as const) {
  const info = META_PLATFORM_REPRESENTATION[platform];
  assert(
    `meta/platform/${platform}/not_independent`,
    info.independentlyImplemented === false &&
      info.representedThrough === "meta",
  );
}

assert(
  "meta/platform/facebook/primary_card",
  META_PLATFORM_REPRESENTATION.facebook.role ===
    "primary_oauth_card",
);

assert(
  "meta/platform/instagram/represented_only",
  META_PLATFORM_REPRESENTATION.instagram.role ===
    "represented_through_meta",
);

assert(
  "meta/platform/threads/represented_only",
  META_PLATFORM_REPRESENTATION.threads.role ===
    "represented_through_meta",
);

const policyExports = Object.keys(lifecyclePolicy);
assert(
  "shared/policy/exports/no_secret_helpers",
  !policyExports.some((name) =>
    /token|secret|verifier|oauthstate/i.test(name),
  ),
  policyExports.join(","),
);

assert(
  "meta/ui/pending → Authorization pending",
  resolveProviderCardLabel({
    implemented: true,
    connectable: true,
    providerState: "ready_for_authorization",
    connectionStatus: "pending_authorization",
    isPrimaryStartCard: true,
    busy: false,
    defaultActionLabel: "Connect",
  }) === "Authorization pending",
);

let pass = 0;
const failures: Case[] = [];

for (const c of cases) {
  if (c.pass) {
    pass++;
  } else {
    failures.push(c);
    console.error(
      `FAIL: ${c.name}${c.detail ? ` → ${c.detail}` : ""}`,
    );
  }
}

console.log(
  `social-lifecycle matrix: ${pass}/${cases.length} pass`,
);

const byProvider = new Map<
  string,
  { pass: number; total: number }
>();

for (const c of cases) {
  const provider =
    PROVIDERS.find((p) =>
      c.name.startsWith(`${p.provider}/`),
    )?.provider ?? "shared";

  const bucket = byProvider.get(provider) ?? {
    pass: 0,
    total: 0,
  };

  bucket.total += 1;
  if (c.pass) {
    bucket.pass += 1;
  }

  byProvider.set(provider, bucket);
}

console.log("\nPer-provider totals:");
for (const [provider, bucket] of byProvider) {
  console.log(`  ${provider}: ${bucket.pass}/${bucket.total}`);
}

const actions = [
  "start_connect",
  "continue_authorization",
  "continue_attempt",
  "cancel_pending",
  "disconnect",
  "add_another_account",
  "scope",
  "platform",
  "ui",
  "unauthorized",
  "policy",
] as const;

console.log("\nPer-action totals:");
for (const action of actions) {
  const matched = cases.filter((c) => {
    const parts = c.name.split("/");
    return parts[1] === action || parts[0] === action;
  });

  const actionPass = matched.filter((c) => c.pass).length;
  if (matched.length > 0) {
    console.log(
      `  ${action}: ${actionPass}/${matched.length}`,
    );
  }
}

console.log("\nMeta platform independence:");
console.log(
  "  Facebook: represented through Meta (primary OAuth card) — not an independent SocialConnectionProvider",
);
console.log(
  "  Instagram: represented through Meta — not independently implemented",
);
console.log(
  "  Threads: represented through Meta — not independently implemented",
);

if (failures.length > 0) {
  process.exit(1);
}
