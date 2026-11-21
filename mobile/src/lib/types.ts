// Shapes returned by /api/mobile/v1 (takatak-v1/src/app/api/mobile/v1).
export type Session = { accessToken: string; refreshToken: string; expiresAt: number };

export type Me = {
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null; displayName: string | null };
  mode: 'client_scoped' | 'selection_required' | 'platform_admin' | 'denied' | 'foundation_demo';
  platformAdmin: boolean;
  workspace: { id: string; name: string; role: string } | null;
  workspaces: { id: string; name: string }[];
  can: { invoices: boolean; dashboard: boolean };
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
