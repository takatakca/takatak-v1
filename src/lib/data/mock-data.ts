// Phase 2 — MOCK FOUNDATION DATA.
// Every record here is illustrative structure only. Nothing is real:
// no real clients, no database, no auth, no connected integrations.
// This file is replaced by Prisma/Supabase queries in Phases 3–4.

import type {
  ActivityEvent,
  AutomationJob,
  Brand,
  Client,
  DashboardStatus,
  IntegrationConnection,
  Location,
  PermissionGroup,
  ServiceInstance,
  UserRole,
} from "./types";

export const MOCK_DATA_LABEL = "Mock foundation data — database not connected yet.";

// ── Clients (3) ─────────────────────────────────────────────
export const CLIENTS: Client[] = [
  {
    id: "cl_alnoor",
    name: "Samir Haddad",
    company: "Al Noor Hospitality Group",
    email: "samir@alnoor.example",
    phone: "+1 555 0101",
    plan: "premium",
    status: "foundation",
    assignedAdmin: "TAKATAK Admin (auth planned)",
    brandIds: ["br_alnoor_rest", "br_alnoor_cafe"],
    createdAt: "2026-07-01",
    dataOrigin: "mock_foundation",
  },
  {
    id: "cl_brightline",
    name: "Dr. Lena Park",
    company: "Brightline Dental",
    email: "lena@brightline.example",
    phone: "+1 555 0102",
    plan: "growth",
    status: "foundation",
    assignedAdmin: "TAKATAK Admin (auth planned)",
    brandIds: ["br_brightline"],
    createdAt: "2026-07-03",
    dataOrigin: "mock_foundation",
  },
  {
    id: "cl_vertex",
    name: "Marco Silva",
    company: "Vertex Fitness Studios",
    email: "marco@vertexfit.example",
    phone: "+1 555 0103",
    plan: "starter",
    status: "foundation",
    assignedAdmin: "TAKATAK Admin (auth planned)",
    brandIds: ["br_vertex_gym", "br_vertex_apparel"],
    createdAt: "2026-07-05",
    dataOrigin: "mock_foundation",
  },
];

// ── Brands (5) ──────────────────────────────────────────────
export const BRANDS: Brand[] = [
  {
    id: "br_alnoor_rest",
    clientId: "cl_alnoor",
    name: "Al Noor Restaurant",
    category: "Restaurant",
    city: "Dubai",
    status: "foundation",
    serviceInstanceIds: ["svc_alnoor_social", "svc_alnoor_web", "svc_alnoor_listings"],
    locationIds: ["loc_alnoor_downtown", "loc_alnoor_marina"],
    dataOrigin: "mock_foundation",
  },
  {
    id: "br_alnoor_cafe",
    clientId: "cl_alnoor",
    name: "Noor Café",
    category: "Café",
    city: "Dubai",
    status: "foundation",
    serviceInstanceIds: ["svc_cafe_social", "svc_cafe_ai"],
    locationIds: ["loc_cafe_jbr"],
    dataOrigin: "mock_foundation",
  },
  {
    id: "br_brightline",
    clientId: "cl_brightline",
    name: "Brightline Dental",
    category: "Healthcare",
    city: "Austin",
    status: "foundation",
    serviceInstanceIds: ["svc_bl_listings", "svc_bl_leads", "svc_bl_web"],
    locationIds: ["loc_bl_austin"],
    dataOrigin: "mock_foundation",
  },
  {
    id: "br_vertex_gym",
    clientId: "cl_vertex",
    name: "Vertex Gym",
    category: "Fitness",
    city: "Lisbon",
    status: "foundation",
    serviceInstanceIds: ["svc_vx_social", "svc_vx_leads"],
    locationIds: [],
    dataOrigin: "mock_foundation",
  },
  {
    id: "br_vertex_apparel",
    clientId: "cl_vertex",
    name: "Vertex Apparel",
    category: "E-commerce",
    city: "Lisbon",
    status: "planned",
    serviceInstanceIds: ["svc_vxa_web"],
    locationIds: [],
    dataOrigin: "mock_foundation",
  },
];

// ── Locations (4) ───────────────────────────────────────────
export const LOCATIONS: Location[] = [
  {
    id: "loc_alnoor_downtown",
    brandId: "br_alnoor_rest",
    label: "Al Noor — Downtown",
    address: "12 Sheikh Zayed Rd",
    city: "Dubai",
    country: "UAE",
    listingStatus: "not_connected",
    dataOrigin: "mock_foundation",
  },
  {
    id: "loc_alnoor_marina",
    brandId: "br_alnoor_rest",
    label: "Al Noor — Marina",
    address: "Marina Walk, Unit 4",
    city: "Dubai",
    country: "UAE",
    listingStatus: "not_connected",
    dataOrigin: "mock_foundation",
  },
  {
    id: "loc_cafe_jbr",
    brandId: "br_alnoor_cafe",
    label: "Noor Café — JBR",
    address: "The Beach, JBR",
    city: "Dubai",
    country: "UAE",
    listingStatus: "planned",
    dataOrigin: "mock_foundation",
  },
  {
    id: "loc_bl_austin",
    brandId: "br_brightline",
    label: "Brightline — Austin Central",
    address: "800 Congress Ave",
    city: "Austin",
    country: "USA",
    listingStatus: "not_connected",
    dataOrigin: "mock_foundation",
  },
];

// ── Service instances ───────────────────────────────────────
export const SERVICE_INSTANCES: ServiceInstance[] = [
  { id: "svc_alnoor_social", brandId: "br_alnoor_rest", module: "social_media", title: "Social Media Management", futureEngine: "Metricool", status: "ready_for_integration", activationPhase: "Phase 6", dataOrigin: "mock_foundation" },
  { id: "svc_alnoor_web", brandId: "br_alnoor_rest", module: "web_hosting", title: "Website & Hosting", futureEngine: "Upmind", status: "ready_for_integration", activationPhase: "Phase 8", dataOrigin: "mock_foundation" },
  { id: "svc_alnoor_listings", brandId: "br_alnoor_rest", module: "local_listings", title: "Local Listings", futureEngine: "QMAPS", status: "not_connected", activationPhase: "Post-MVP", dataOrigin: "mock_foundation" },
  { id: "svc_cafe_social", brandId: "br_alnoor_cafe", module: "social_media", title: "Social Media Management", futureEngine: "Metricool", status: "ready_for_integration", activationPhase: "Phase 6", dataOrigin: "mock_foundation" },
  { id: "svc_cafe_ai", brandId: "br_alnoor_cafe", module: "ai_studio", title: "AI Creative Studio", futureEngine: "TryHolo / OpenAI", status: "disabled", activationPhase: "Phases 9–10", dataOrigin: "mock_foundation" },
  { id: "svc_bl_listings", brandId: "br_brightline", module: "local_listings", title: "Local Listings", futureEngine: "QMAPS", status: "not_connected", activationPhase: "Post-MVP", dataOrigin: "mock_foundation" },
  { id: "svc_bl_leads", brandId: "br_brightline", module: "leads", title: "Lead Generation", futureEngine: "FLEXS", status: "not_connected", activationPhase: "Post-MVP", dataOrigin: "mock_foundation" },
  { id: "svc_bl_web", brandId: "br_brightline", module: "web_hosting", title: "Website & Hosting", futureEngine: "Upmind", status: "planned", activationPhase: "Phase 8", dataOrigin: "mock_foundation" },
  { id: "svc_vx_social", brandId: "br_vertex_gym", module: "social_media", title: "Social Media Management", futureEngine: "Metricool", status: "planned", activationPhase: "Phase 6", dataOrigin: "mock_foundation" },
  { id: "svc_vx_leads", brandId: "br_vertex_gym", module: "leads", title: "Lead Generation", futureEngine: "FLEXS", status: "planned", activationPhase: "Post-MVP", dataOrigin: "mock_foundation" },
  { id: "svc_vxa_web", brandId: "br_vertex_apparel", module: "web_hosting", title: "Website & Hosting", futureEngine: "Upmind", status: "planned", activationPhase: "Phase 8", dataOrigin: "mock_foundation" },
];

// ── Integration records ─────────────────────────────────────
export const INTEGRATIONS: IntegrationConnection[] = [
  { id: "int_metricool", provider: "metricool", displayName: "Metricool", purpose: "Social media engine: scheduling, publishing, analytics, calendar, white-label reports", status: "not_connected", requirement: "Real API credentials + adapter", activationPhase: "Phase 6", envVars: ["METRICOOL_API_KEY", "METRICOOL_ACCOUNT_ID", "METRICOOL_WHITE_LABEL_BASE_URL"], dataOrigin: "mock_foundation" },
  { id: "int_upmind", provider: "upmind", displayName: "Upmind", purpose: "Web/domain/hosting engine: domains, plans, provisioning, invoices, support desk", status: "not_connected", requirement: "Real API credentials + adapter + webhook secret", activationPhase: "Phase 8", envVars: ["UPMIND_API_KEY", "UPMIND_API_BASE_URL", "UPMIND_WEBHOOK_SECRET"], dataOrigin: "mock_foundation" },
  { id: "int_tryholo", provider: "tryholo", displayName: "TryHolo", purpose: "Optional creative AI provider: video ideas, ad creatives, hooks, briefs", status: "disabled", requirement: "TRYHOLO_ENABLED=true + credentials; platform must never depend on it", activationPhase: "Phase 10", envVars: ["TRYHOLO_API_KEY", "TRYHOLO_ENABLED"], dataOrigin: "mock_foundation" },
  { id: "int_qmaps", provider: "qmaps", displayName: "QMAPS", purpose: "Local listings: business profiles, citations, reviews, visibility", status: "not_connected", requirement: "Real API credentials + adapter", activationPhase: "Post-MVP", envVars: ["QMAPS_API_KEY", "QMAPS_API_BASE_URL"], dataOrigin: "mock_foundation" },
  { id: "int_flexs", provider: "flexs", displayName: "FLEXS", purpose: "Lead generation: pipeline, campaigns, follow-ups", status: "not_connected", requirement: "Real API credentials + adapter", activationPhase: "Post-MVP", envVars: ["FLEXS_API_KEY", "FLEXS_API_BASE_URL"], dataOrigin: "mock_foundation" },
  { id: "int_supabase", provider: "supabase", displayName: "Supabase", purpose: "Auth, Postgres database, storage", status: "needs_configuration", requirement: "Project keys + cookie-based auth setup", activationPhase: "Phase 3", envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], dataOrigin: "mock_foundation" },
  { id: "int_stripe", provider: "stripe", displayName: "Stripe", purpose: "Payments and subscription billing", status: "planned", requirement: "Keys + webhook secret after core tenancy is stable", activationPhase: "Later phase", envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"], dataOrigin: "mock_foundation" },
];

// ── Automation jobs (planned — no workers exist) ────────────
export const AUTOMATION_JOBS: AutomationJob[] = [
  { id: "job_create_campaign", name: "Create campaign", module: "social_media", trigger: "manual", status: "planned", activationPhase: "Phase 5", description: "Create a campaign record and attach posts.", dataOrigin: "mock_foundation" },
  { id: "job_generate_content", name: "Generate content", module: "ai_studio", trigger: "manual", status: "planned", provider: "tryholo", activationPhase: "Phase 9", description: "Generate captions/hooks and route into drafts.", dataOrigin: "mock_foundation" },
  { id: "job_approve_post", name: "Approve post", module: "social_media", trigger: "workflow", status: "planned", activationPhase: "Phase 5", description: "Client approval moves a post to approved.", dataOrigin: "mock_foundation" },
  { id: "job_send_metricool", name: "Send to Metricool", module: "social_media", trigger: "workflow", status: "planned", provider: "metricool", activationPhase: "Phase 6", description: "Push approved, scheduled posts to Metricool.", dataOrigin: "mock_foundation" },
  { id: "job_sync_analytics", name: "Sync analytics", module: "social_media", trigger: "scheduled", status: "planned", provider: "metricool", activationPhase: "Phase 6", description: "Pull daily analytics per connected account.", dataOrigin: "mock_foundation" },
  { id: "job_generate_report", name: "Generate report", module: "reports", trigger: "scheduled", status: "planned", activationPhase: "Phase 12", description: "Build client-ready reports from module data.", dataOrigin: "mock_foundation" },
  { id: "job_provision_hosting", name: "Provision hosting service", module: "web_hosting", trigger: "webhook", status: "planned", provider: "upmind", activationPhase: "Phase 8", description: "Track Upmind provisioning through to live.", dataOrigin: "mock_foundation" },
  { id: "job_notify_client", name: "Send client notification", module: "core", trigger: "workflow", status: "planned", activationPhase: "Phase 11", description: "Notify clients about approvals, reports, renewals.", dataOrigin: "mock_foundation" },
  { id: "job_retry_failed", name: "Retry failed integration task", module: "core", trigger: "workflow", status: "planned", activationPhase: "Phase 11", description: "Retry with backoff; log attempts and errors.", dataOrigin: "mock_foundation" },
];

// ── Activity events (foundation history — real, but about the build) ─
export const ACTIVITY_EVENTS: ActivityEvent[] = [
  { id: "act_p0", kind: "architecture", message: "Phase 0 architecture locked", detail: "Scaffold, env template, layer rules, adapter boundaries", phase: "Phase 0", dataOrigin: "mock_foundation" },
  { id: "act_master", kind: "documentation", message: "Master screen architecture documented", detail: "Complete screen map, statuses, build order (Phases 0–14)", phase: "Phase 0", dataOrigin: "mock_foundation" },
  { id: "act_p1", kind: "build", message: "Dashboard shell implemented", detail: "Sidebar, topbar, overview, 15 module placeholders", phase: "Phase 1", dataOrigin: "mock_foundation" },
  { id: "act_p1v", kind: "verification", message: "All dashboard routes verified HTTP 200", detail: "18 routes checked; zero fake connected states", phase: "Phase 1", dataOrigin: "mock_foundation" },
  { id: "act_p2", kind: "build", message: "Core SaaS data foundation started", detail: "Typed models + mock data + reusable SaaS components", phase: "Phase 2", dataOrigin: "mock_foundation" },
  { id: "act_int", kind: "integration", message: "Integrations pending credentials", detail: "Metricool, Upmind, QMAPS, FLEXS not connected; TryHolo disabled", phase: "Phase 2", dataOrigin: "mock_foundation" },
];

// ── Roles & permissions plan (activates with auth, Phase 3) ─
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { id: "pg_platform", label: "Platform administration", description: "Full platform control", permissions: ["manage_clients", "manage_services", "manage_integrations", "view_logs", "retry_jobs", "manage_billing", "manage_roles"] },
  { id: "pg_delivery", label: "Service delivery", description: "Operate assigned client work", permissions: ["manage_campaigns", "manage_reports", "manage_files", "handle_tickets", "view_jobs"] },
  { id: "pg_client_manage", label: "Client management", description: "Client-side control of their business", permissions: ["manage_business_profile", "approve_posts", "view_reports", "view_billing", "upload_files", "request_changes"] },
  { id: "pg_contribute", label: "Contribution", description: "Limited collaboration", permissions: ["view_assigned", "comment_posts", "upload_files"] },
  { id: "pg_client_basic", label: "Client basics", description: "Everyday client access", permissions: ["view_dashboard", "approve_content", "view_reports", "pay_invoices", "open_tickets", "download_files"] },
];

export const USER_ROLES: UserRole[] = [
  { key: "super_admin", label: "Super Admin", scope: "Full TAKATAK control", status: "ready_for_auth", permissionGroupIds: ["pg_platform", "pg_delivery"] },
  { key: "admin", label: "Admin", scope: "Internal TAKATAK staff", status: "ready_for_auth", permissionGroupIds: ["pg_delivery"] },
  { key: "manager", label: "Manager", scope: "Client-side manager", status: "ready_for_auth", permissionGroupIds: ["pg_client_manage"] },
  { key: "team_member", label: "Team Member", scope: "Limited staff user", status: "ready_for_auth", permissionGroupIds: ["pg_contribute"] },
  { key: "client_user", label: "Client User", scope: "Basic client access", status: "ready_for_auth", permissionGroupIds: ["pg_client_basic"] },
];

// ── Platform readiness summary ──────────────────────────────
export const PLATFORM_STATUS: DashboardStatus[] = [
  { area: "Dashboard shell", status: "foundation", note: "Phase 1 complete" },
  { area: "Core data structure", status: "mock_data", note: "Phase 2 — typed mock foundation" },
  { area: "Authentication", status: "ready_for_auth", note: "Supabase Auth planned — Phase 3" },
  { area: "Database", status: "needs_configuration", note: "Prisma + Supabase Postgres — Phase 4" },
  { area: "Integrations", status: "not_connected", note: "Adapters begin Phase 6" },
  { area: "Background jobs", status: "planned", note: "Workers arrive Phase 11" },
];

// ── Lookup helpers (pure, no side effects) ──────────────────
export const clientById = (id: string) => CLIENTS.find((c) => c.id === id);
export const brandById = (id: string) => BRANDS.find((b) => b.id === id);
export const brandsForClient = (clientId: string) => BRANDS.filter((b) => b.clientId === clientId);
export const servicesForBrand = (brandId: string) => SERVICE_INSTANCES.filter((s) => s.brandId === brandId);
export const locationsForBrand = (brandId: string) => LOCATIONS.filter((l) => l.brandId === brandId);
