// Master API scopes. Each child application that talks to the master API holds its own key and announces its own
// source application; a key never opens another application's scope, and the 1LV scope keeps exactly the surface it
// had before ON2GO existed (owner's blueprint for ON2GO, slice 6: "sa clé, sa source, jamais desserrer 1LV").
//
//   1lv      TAKATAK_1LV_API_KEY      the 1LV marketplace (people, merchants, events)
//   on2go    TAKATAK_ON2GO_API_KEY    on2go.ca customers: phone sign-in, person resolution, customer events
//   foodhub  TAKATAK_FOODHUB_API_KEY  ON2GO Hub (Food Hub): merchants, entitlements read, order / merchant events
//
// No code in this file reads a database: it is unit-tested without one.

export const MASTER_API_SCOPES = ["1lv", "on2go", "foodhub"] as const;
export type MasterApiScope = (typeof MASTER_API_SCOPES)[number];

export const MASTER_API_SCOPE_ENV: Record<MasterApiScope, string> = {
  "1lv": "TAKATAK_1LV_API_KEY",
  on2go: "TAKATAK_ON2GO_API_KEY",
  foodhub: "TAKATAK_FOODHUB_API_KEY",
};

/** Keys shorter than this are treated as not configured (never as a weak key). */
export const MASTER_API_MIN_KEY_LENGTH = 32;

/** The scopes each master route accepts. A route not listed here is 1LV only. */
export const MASTER_API_ROUTE_SCOPES = {
  otpSend: ["1lv", "on2go", "foodhub"],
  otpVerify: ["1lv", "on2go", "foodhub"],
  resolvePerson: ["1lv", "on2go", "foodhub"],
  resolveMerchant: ["1lv", "foodhub"],
  events: ["1lv", "on2go", "foodhub"],
  merchantEntitlements: ["1lv", "foodhub"],
} as const satisfies Record<string, readonly MasterApiScope[]>;

export function isMasterApiScope(value: unknown): value is MasterApiScope {
  return (
    typeof value === "string" &&
    (MASTER_API_SCOPES as readonly string[]).includes(value)
  );
}

/**
 * The source application a payload may announce under a scope: exactly the scope's own name. A 1LV key cannot
 * write `source_application: "on2go"` and the reverse; the stored SourceProfile / SourceMerchant rows therefore
 * always say which application created them.
 */
export function sourceForScope(
  rawSource: unknown,
  scope: MasterApiScope,
): { ok: true; source: MasterApiScope } | { ok: false; error: string } {
  const source =
    typeof rawSource === "string" ? rawSource.trim().toLowerCase() : "";
  if (source !== scope) {
    return { ok: false, error: "Unsupported source application." };
  }
  return { ok: true, source: scope };
}
