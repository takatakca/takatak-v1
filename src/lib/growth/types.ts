// Growth Suite — shared types.
// Every status here is presence metadata only. "connected" is reserved for a
// provider whose real, documented API call has succeeded (architecture §25/§28),
// so this layer never produces it.

export type ConnectorCategory =
  | "domains_hosting"
  | "social"
  | "analytics"
  | "ads"
  | "reviews"
  | "local"
  | "messaging"
  | "seo"
  | "leads"
  | "payments";

/**
 * - `built_in`: a TAKATAK-native engine that runs without third-party credentials.
 * - `configured_untested`: every required env var is present; no call verified.
 * - `not_configured`: at least one required env var is missing.
 * - `planned`: no adapter exists yet; nothing can be configured.
 */
export type ConnectorState =
  | "built_in"
  | "configured_untested"
  | "not_configured"
  | "planned";

export interface ConnectorDef {
  key: string;
  name: string;
  category: ConnectorCategory;
  purpose: string;
  /** Required server-side env vars. Empty for built-in or planned connectors. */
  env: string[];
  kind: "external" | "built_in" | "planned";
  /** Where the connector is managed when another module owns it. */
  managedIn?: string;
  docsUrl?: string;
}

export interface ConnectorStatus extends ConnectorDef {
  state: ConnectorState;
  missing: string[];
}

export interface GrowthStage {
  key: string;
  step: number;
  title: string;
  href: string;
  summary: string;
  connectorKeys: string[];
}
