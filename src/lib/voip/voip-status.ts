// Business phone (VoIP) connection status for the TAKATAK dashboard.
//
// VoIP belongs to MIMT, an independent telecom app. TAKATAK only shows an
// authorized overview. This module is pure: it reads environment values and
// never makes a network call. The live overview request is mimt-client.ts
// (Gate 3). This module only returns the first two states.

export type VoipConnectionState =
  | "not_configured"
  | "configured_untested"
  | "verified_staging"
  | "verified_production"
  | "error";

/** The only states this module can return (no live evidence exists). */
export type VoipShellState = Extract<VoipConnectionState, "not_configured" | "configured_untested">;

export interface VoipConnectionStatus {
  state: VoipShellState;
  label: string;
  detail: string;
}

type EnvLike = Record<string, string | undefined>;

function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** True only for an absolute https:// URL with a host. */
export function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function getVoipConnectionStatus(env: EnvLike = process.env): VoipConnectionStatus {
  const apiUrl = present(env.MIMT_API_URL);
  const apiKey = present(env.MIMT_API_KEY);

  if (apiUrl && apiKey && isHttpsUrl(apiUrl)) {
    return {
      state: "configured_untested",
      label: "MIMT configured, not tested",
      detail:
        "MIMT settings are present, but no live check has run yet. Phone data stays hidden until a connection test succeeds.",
    };
  }

  let detail = "MIMT is not connected to this workspace yet.";
  if (apiUrl && !isHttpsUrl(apiUrl)) {
    detail = "The MIMT address must start with https://. MIMT stays not connected until it does.";
  } else if (apiUrl && !apiKey) {
    detail = "The MIMT address is set, but the MIMT access key is missing.";
  } else if (!apiUrl && apiKey) {
    detail = "The MIMT access key is set, but the MIMT address is missing.";
  }

  return { state: "not_configured", label: "MIMT not connected", detail };
}
