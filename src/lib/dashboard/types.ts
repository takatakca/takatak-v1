// Phase 1 — Dashboard shell types.
// All data rendered from these types is FOUNDATION/MOCK data until the
// database (Phase 4) and real integrations (Phase 6+) exist.

import type { LucideIcon } from "lucide-react";

/** Honest status vocabulary. "connected" may only be used once a real
 *  credentialed API call has succeeded (see architecture docs §25/§28). */
export type IntegrationStatus =
  | "not_connected"
  | "planned"
  | "disabled"
  | "pending_credentials"
  | "connected"
  | "error"
  | "expired";

export type ModuleStatus = "not_connected" | "planned" | "disabled" | "foundation";

export type JobStatus = "planned" | "queued" | "running" | "completed" | "failed";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visual chevron — nested destinations arrive in a later pass. */
  hasDropdown?: boolean;
  children?: NavItem[];
}

export interface KpiCard {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

export interface ServiceModule {
  slug: string;
  title: string;
  href: string;
  purpose: string;
  engine?: string;
  status: ModuleStatus;
  functions: string[];
  icon: LucideIcon;
}

export interface IntegrationRow {
  name: string;
  purpose: string;
  status: IntegrationStatus;
  actionLabel: string;
}

export interface JobPreviewItem {
  name: string;
  status: JobStatus;
}

export interface ActivityItem {
  message: string;
  detail?: string;
}

export interface QuickAction {
  label: string;
  href?: string;
  comingSoon?: boolean;
  icon: LucideIcon;
}

export interface ModulePlaceholderDef {
  title: string;
  purpose: string;
  engine?: string;
  status: ModuleStatus;
  functions: string[];
  note?: string;
}
