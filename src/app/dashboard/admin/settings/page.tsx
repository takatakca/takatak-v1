import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const CHECKLISTS: { title: string; subtitle: string; items: string[] }[] = [
  { title: "Environment readiness", subtitle: "Set in your deployment environment — never committed.", items: ["DATABASE_URL + DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL + anon key", "METRICOOL_API_KEY + ACCOUNT_ID + documented endpoints", "UPMIND_API_KEY + API_BASE_URL + documented endpoints", "OPENAI_API_KEY (AI phases)", "TRYHOLO_ENABLED flag (optional provider)"] },
  { title: "Security settings", subtitle: "Planned — no settings writes exist in Phase 13.", items: ["Apply RLS 001-007 on Supabase", "Review role permissions before inviting real users", "Audit retention policy", "Webhook signature rules (Upmind — pending official docs)"] },
  { title: "Operations", subtitle: "Planned — no workers or automations exist.", items: ["Job worker (future phase)", "Report export + delivery (future phase)", "Email/SMS settings (future phase)", "Provider sync schedules (after verified connections)"] },
];

export default async function AdminSettingsPage() {
  const access = await requireAdminAccess();
  return (
    <div className="space-y-5">
      <AdminHeader title="Settings" subtitle="Admin settings foundation — readiness checklists only. Nothing on this page writes configuration." badges={["Planned", "No writes"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
        {CHECKLISTS.map((c) => (
          <Card key={c.title}>
            <CardHeader title={c.title} subtitle={c.subtitle} />
            <CardBody className="space-y-1.5">
              {c.items.map((item) => (
                <p key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <Badge tone="muted">Planned</Badge> {item}
                </p>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
      <AdminBoundaryWarning />
    </div>
  );
}
