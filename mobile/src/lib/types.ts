// Shapes returned by /api/mobile/v1 (takatak-v1/src/app/api/mobile/v1).
export type Session = { accessToken: string; refreshToken: string; expiresAt: number };

export type Me = {
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null; displayName: string | null };
  mode: 'client_scoped' | 'selection_required' | 'platform_admin' | 'denied' | 'foundation_demo';
  platformAdmin: boolean;
  workspace: { id: string; name: string; role: string } | null;
  workspaces: { id: string; name: string }[];
  can: { invoices: boolean; dashboard: boolean; team?: boolean };
};

export type Kpi = { label: string; value: number | null; previous: number | null; series: number[]; hint: string; available: boolean };
export type Integration = { key: 'website' | 'social' | 'advertising' | 'reviews'; label: string; href: string; detail: string; platforms: string[]; status: 'connected' | 'not_connected' | 'error' | 'expired' };

export type Home = {
  source: 'database' | 'mock' | 'unavailable';
  sourceLabel: string;
  range: { from: string; to: string };
  welcomeName: string;
  kpis: { reach: Kpi; engagement: Kpi; websiteTraffic: Kpi; conversions: Kpi; avgRating: Kpi & { reviewCount: number } };
  integrations: Integration[];
  performance: { key: string; label: string; value: number; color: string }[];
  topPages: { path: string; sessions: number; changePct: number | null }[];
  topPosts: { id: string; platform: string; caption: string; engagement: number | null; live: boolean }[];
  reviews: { id: string; reviewerName: string; rating: number | null; body: string; provider: string; reviewedAt: string | null }[];
};

export type Notification = { id: string; type: string; title: string; message: string; status: 'unread' | 'read' | 'archived' | string; createdAt: string; href: string | null };

export type Invoice = {
  id: string; source: string; number: string | null; description: string | null; issuedAt: string; dueAt: string | null; paidAt: string | null;
  currency: string; totalMinor: number; amountDueMinor: number; amountPaidMinor: number; status: string; payUrl: string | null; pdfUrl: string | null;
};
export type Invoices = { status: 'ok'; invoices: Invoice[]; partial: boolean } | { status: 'no_billing_account' } | { status: 'unavailable' };

export type Lead = { id: string; name: string; email: string | null; phone: string | null; company: string | null; message: string | null; status: string; priority: string; source: string | null; campaign: string | null; followUpAt: string | null; createdAt: string };
export type Leads = { available: boolean; kpis: { leads: number; sources: number; campaigns: number; followUpsPlanned: number; qualifiedLeads: number } | null; pipeline: { status: string; count: number }[]; leads: Lead[]; total: number };
export type Domain = { id: string; name: string; brand: string | null; registrar: string | null; status: string; dns: string; ssl: string; autoRenew: boolean; expiresAt: string | null };
export type Hosting = { id: string; plan: string; brand: string | null; domain: string | null; status: string; server: string; renewsAt: string | null };
export type Web = { available: boolean; domains: Domain[]; hosting: Hosting[] };
export type Member = { id: string; name: string | null; email: string | null; role: string; status: 'active' | 'suspended'; joinedAt: string; me: boolean };
export type Team = { available: boolean; members: Member[]; pendingInvitations: number };
