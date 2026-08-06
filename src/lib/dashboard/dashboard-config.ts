// Phase 1 — Central dashboard configuration.
// MOCK / FOUNDATION DATA ONLY. No database, no auth, no real integrations.
// Numbers and lists here are placeholders until Phase 4 (Prisma) and
// Phase 6+ (real adapters). Keep pages thin: they render from this file.

import {
  Bell,
  BotMessageSquare,
  Briefcase,
  Building2,
  CalendarClock,
  FileBarChart2,
  FileStack,
  FolderOpen,
  Globe,
  History,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPin,
  MapPinned,
  Megaphone,
  PlugZap,
  Plus,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import type {
  ActivityItem,
  IntegrationRow,
  JobPreviewItem,
  KpiCard,
  ModulePlaceholderDef,
  NavItem,
  QuickAction,
  ServiceModule,
} from "./types";

export const APP_NAME = "TAKATAK";
export const APP_FULL_NAME = "TAKATAK User Official Dashboard V1";

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Clients & Services",
    items: [
      { label: "Clients", href: "/dashboard/clients", icon: Users },
      { label: "Businesses / Brands", href: "/dashboard/brands", icon: Building2 },
      { label: "Locations", href: "/dashboard/locations", icon: MapPinned },
      { label: "Services", href: "/dashboard/services", icon: ListChecks },
    ],
  },
  {
    title: "Modules",
    items: [
      { label: "Social Media", href: "/dashboard/social", icon: Share2 },
      { label: "Web & Hosting", href: "/dashboard/web-hosting", icon: Globe },
      { label: "Local Listings", href: "/dashboard/local-listings", icon: MapPin },
      { label: "Leads", href: "/dashboard/leads", icon: Megaphone },
      { label: "AI Studio", href: "/dashboard/ai-studio", icon: Sparkles },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Reports", href: "/dashboard/reports", icon: FileBarChart2 },
      { label: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      { label: "Files", href: "/dashboard/files", icon: FolderOpen },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Integrations", href: "/dashboard/integrations", icon: PlugZap },
      { label: "Jobs", href: "/dashboard/jobs", icon: CalendarClock },
      { label: "Activity", href: "/dashboard/activity", icon: History },
      { label: "Team & Permissions", href: "/dashboard/team", icon: ShieldCheck },
      { label: "Admin", href: "/dashboard/admin", icon: Briefcase },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

/** Flat list kept for compatibility with existing consumers. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// KPI cards — static placeholders. Real values arrive with the database (Phase 4).
export const KPI_CARDS: KpiCard[] = [
  { label: "Clients", value: "0", hint: "Mock foundation data", icon: Users },
  { label: "Businesses / Brands", value: "0", hint: "Mock foundation data", icon: Building2 },
  { label: "Active Services", value: "0", hint: "Mock foundation data", icon: ListChecks },
  { label: "Pending Jobs", value: "0", hint: "Job system planned", icon: CalendarClock },
  { label: "Reports Ready", value: "0", hint: "Reports engine planned", icon: FileStack },
];

export const SERVICE_MODULES: ServiceModule[] = [
  {
    slug: "social",
    title: "Social Media",
    href: "/dashboard/social",
    purpose: "Scheduling, publishing, analytics, and client-ready social reports.",
    engine: "Metricool",
    status: "not_connected",
    functions: ["Scheduling", "Publishing", "Analytics", "Reports"],
    icon: Share2,
  },
  {
    slug: "web-hosting",
    title: "Web / Domain / Hosting",
    href: "/dashboard/web-hosting",
    purpose: "Domains, hosting plans, billing, and service provisioning.",
    engine: "Upmind",
    status: "not_connected",
    functions: ["Domains", "Hosting", "Billing", "Provisioning"],
    icon: Globe,
  },
  {
    slug: "ai-studio",
    title: "AI Creative Studio",
    href: "/dashboard/ai-studio",
    purpose: "Captions, hooks, creative briefs, and video ideas that feed approvals.",
    engine: "TryHolo / OpenAI",
    status: "disabled",
    functions: ["Captions", "Hooks", "Creative briefs", "Video ideas"],
    icon: Sparkles,
  },
  {
    slug: "local-listings",
    title: "Local Listings",
    href: "/dashboard/local-listings",
    purpose: "Business listings, citations, reviews, and local visibility.",
    engine: "QMAPS",
    status: "not_connected",
    functions: ["Business listings", "Citations", "Reviews", "Local visibility"],
    icon: MapPin,
  },
  {
    slug: "leads",
    title: "Lead Generation",
    href: "/dashboard/leads",
    purpose: "Lead pipeline, campaigns, contacts, and follow-ups.",
    engine: "FLEXS",
    status: "not_connected",
    functions: ["Lead pipeline", "Campaigns", "Contacts", "Follow-ups"],
    icon: Megaphone,
  },
];

export const INTEGRATION_ROWS: IntegrationRow[] = [
  { name: "Metricool", purpose: "Social media engine", status: "not_connected", actionLabel: "Credentials required" },
  { name: "Upmind", purpose: "Web / domain / hosting engine", status: "not_connected", actionLabel: "Credentials required" },
  { name: "TryHolo", purpose: "Creative AI provider (optional)", status: "disabled", actionLabel: "Feature flag off" },
  { name: "QMAPS", purpose: "Local listings", status: "not_connected", actionLabel: "Credentials required" },
  { name: "FLEXS", purpose: "Lead generation", status: "not_connected", actionLabel: "Credentials required" },
  { name: "Supabase", purpose: "Auth, database, storage", status: "planned", actionLabel: "Planned setup (Phase 3)" },
  { name: "Stripe", purpose: "Payments and billing", status: "planned", actionLabel: "Planned setup" },
];

export const JOB_PREVIEW: JobPreviewItem[] = [
  { name: "Create campaign", status: "planned" },
  { name: "Generate content", status: "planned" },
  { name: "Approve post", status: "planned" },
  { name: "Send to Metricool", status: "planned" },
  { name: "Sync analytics", status: "planned" },
  { name: "Generate report", status: "planned" },
  { name: "Provision hosting service", status: "planned" },
  { name: "Send client notification", status: "planned" },
];

export const ACTIVITY_FEED: ActivityItem[] = [
  { message: "Phase 0 architecture locked", detail: "Scaffold, env template, and layer rules in place" },
  { message: "Full screen architecture documented", detail: "Master screen map for all V1 modules" },
  { message: "Dashboard shell started", detail: "Phase 1 — core layout, navigation, and module placeholders" },
  { message: "Integrations pending credentials", detail: "Metricool, Upmind, QMAPS, FLEXS not connected" },
  { message: "Auth / database not configured yet", detail: "Supabase planned for Phase 3, Prisma for Phase 4" },
];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Client", href: "/dashboard/clients", icon: UserPlus },
  { label: "Add Business / Brand", href: "/dashboard/brands", icon: Building2 },
  { label: "Create Campaign", comingSoon: true, icon: Plus },
  { label: "Connect Integration", comingSoon: true, icon: PlugZap },
  { label: "Generate Report", comingSoon: true, icon: FileBarChart2 },
  { label: "Open AI Studio", href: "/dashboard/ai-studio", icon: BotMessageSquare },
];

// Placeholder page definitions for every sidebar module (Phase 1).
export const MODULE_PLACEHOLDERS: Record<string, ModulePlaceholderDef> = {
  clients: {
    title: "Clients",
    purpose: "Manage all client accounts: profiles, plans, assigned admins, services, and activity.",
    status: "foundation",
    functions: ["Client list with search and filters", "Create / edit / disable clients", "Assign admins", "Client profile with businesses, services, invoices, reports, files"],
    note: "Client data arrives with the Core SaaS Data Foundation (Phase 2) and database (Phase 4).",
  },
  brands: {
    title: "Businesses / Brands",
    purpose: "Brand-level control center: profiles, services, social accounts, web presence, and billing status.",
    status: "foundation",
    functions: ["Brand list with status badges", "Create / edit brands and assign services", "Brand profile: logo, voice, category, location", "Per-brand reports and files"],
    note: "Brand data arrives with Phase 2 (mock structure) and Phase 4 (database).",
  },
  social: {
    title: "Social Media",
    purpose: "Social operations for every brand: accounts, calendar, campaigns, approvals, analytics, and reports.",
    engine: "Metricool",
    status: "not_connected",
    functions: ["Connected accounts", "Content calendar", "Campaigns", "Posts and approvals", "Analytics", "Reports"],
  },
  "web-hosting": {
    title: "Web / Domain / Hosting",
    purpose: "Web infrastructure for clients: domains, hosting, SSL, DNS, provisioning, and related billing.",
    engine: "Upmind",
    status: "not_connected",
    functions: ["Domain search", "Hosting plans", "Service list", "Domain portfolio", "SSL status", "DNS management", "Invoices", "Support tickets"],
  },
  "local-listings": {
    title: "Local Listings",
    purpose: "Local presence management: listings, citations, reviews, and visibility.",
    engine: "QMAPS",
    status: "not_connected",
    functions: ["Business listings", "Citations and NAP consistency", "Review monitoring and replies", "Local visibility reporting"],
  },
  leads: {
    title: "Leads",
    purpose: "Lead generation and pipeline management for client campaigns.",
    engine: "FLEXS",
    status: "not_connected",
    functions: ["Lead pipeline (new → won/lost)", "Lead campaigns", "Contact database", "Follow-up tasks"],
  },
  "ai-studio": {
    title: "AI Studio",
    purpose: "AI content and business assistant center. AI supports the workflows — it is a layer, not the platform.",
    engine: "TryHolo / OpenAI",
    status: "disabled",
    functions: ["Content generator (captions, hashtags, hooks, CTAs)", "Campaign builder", "Video idea generator", "Creative brief generator", "Saved outputs feeding the approval workflow"],
  },
  reports: {
    title: "Reports",
    purpose: "Client-ready reporting across social, web, listings, and leads.",
    status: "planned",
    functions: ["Report center by type", "Custom report builder", "Templates (weekly social, monthly client, hosting status)", "AI summaries", "Export and client sharing (later)"],
    note: "Reports engine is built in Phase 12.",
  },
  invoices: {
    title: "Invoices",
    purpose: "Client invoice center across billing providers.",
    engine: "Stripe / Upmind",
    status: "planned",
    functions: ["Invoice list with status", "Subscriptions", "Payment methods", "Download PDF (later)"],
  },
  files: {
    title: "Files",
    purpose: "Client file manager with folders, sharing, and attachments to reports or tickets.",
    engine: "Supabase Storage",
    status: "planned",
    functions: ["Upload / download", "Folders and permissions", "Share with client", "Attach to report or ticket"],
  },
  notifications: {
    title: "Notifications",
    purpose: "Notification center for approvals, reports, invoices, integration errors, and job failures.",
    status: "planned",
    functions: ["Approval needed", "Report ready", "Invoice due", "Integration error", "Job failed", "Support reply", "Service renewal"],
  },
  support: {
    title: "Support",
    purpose: "Support ticket center with conversations, internal notes, and attachments.",
    engine: "Upmind service desk (later)",
    status: "planned",
    functions: ["Ticket list with status and priority", "Reply and internal notes", "Assign / escalate / close", "Attachments"],
  },
  team: {
    title: "Team & Permissions",
    purpose: "Manage users, staff, and role-based access control.",
    status: "planned",
    functions: ["Team member list", "Invite users", "Roles: Super Admin, Admin, Manager, Team Member, Client User", "Assign permissions and restrict modules"],
    note: "Roles activate with auth (Phase 3) and permissions hardening (Phase 14).",
  },
  admin: {
    title: "Admin Control Tower",
    purpose: "Internal TAKATAK command center: all clients, services, integrations, jobs, and system health.",
    status: "foundation",
    functions: ["Platform-wide overview", "Job monitoring and retries", "Integration management", "System health checks", "Logs and error review"],
    note: "Built out in Phase 13. Job system arrives in Phase 11.",
  },
  settings: {
    title: "Settings",
    purpose: "Account, branding, notifications, billing, security, and integration settings.",
    status: "foundation",
    functions: ["Account and business profile", "White-label branding (logo, colors, portal name)", "Client-level integration settings", "Security: sessions, 2FA (later), audit log"],
  },
};

export const STATUS_LABELS: Record<string, string> = {
  not_connected: "Not connected",
  planned: "Planned",
  disabled: "Disabled",
  pending_credentials: "Pending credentials",
  connected: "Connected",
  error: "Error",
  expired: "Expired",
  foundation: "Foundation",
};
