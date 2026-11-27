import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const CHECKLISTS: { title: string; subtitle: string; items: string[] }[] = [
  { title: "Environment readiness", subtitle: "Set in your deployment environment — never committed.", items: ["DATABASE_URL + DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL + anon key", "METRICOOL_API_KEY + ACCOUNT_ID + documented endpoints", "UPMIND_API_KEY + API_BASE_URL + documented endpoints", "OPENAI_API_KEY (AI phases)", "TRYHOLO_ENABLED flag (optional provider)"] },
  { title: "Security settings", subtitle: "Planned — no settings writes exist in Phase 13.", items: ["Apply RLS 001-007 on Supabase", "Review role permissions before inviting real users", "Audit retention policy", "Webhook signature rules (Upmind — pending official docs)"] },
  { title: "Operations", subtitle: "Planned — no workers or automations exist.", items: ["Job worker (future phase)", "Report export + delivery (future phase)", "Email/SMS settings (future phase)", "Provider sync schedules (after verified connections)"] },
];

const CHECKLISTS_FR: typeof CHECKLISTS = [
  { title: "Préparation de l’environnement", subtitle: "À régler dans votre environnement de déploiement, jamais dans le code.", items: ["DATABASE_URL + DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL + clé anon", "METRICOOL_API_KEY + ACCOUNT_ID + points d’accès documentés", "UPMIND_API_KEY + API_BASE_URL + points d’accès documentés", "OPENAI_API_KEY (phases IA)", "Interrupteur TRYHOLO_ENABLED (fournisseur facultatif)"] },
  { title: "Réglages de sécurité", subtitle: "Prévu : aucune modification de réglage n’existe encore.", items: ["Appliquer RLS 001-007 sur Supabase", "Revoir les permissions des rôles avant d’inviter de vrais utilisateurs", "Politique de conservation de l’audit", "Règles de signature des webhooks (Upmind : documentation officielle attendue)"] },
  { title: "Opérations", subtitle: "Prévu : aucun exécuteur ni automatisation n’existe.", items: ["Exécuteur de tâches (phase future)", "Export et envoi des rapports (phase future)", "Réglages courriel et texto (phase future)", "Horaires de synchronisation des fournisseurs (après des branchements vérifiés)"] },
];

export default async function AdminSettingsPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  return (
    <div className="space-y-5">
      <AdminHeader
        title={fr ? "Réglages" : "Settings"}
        subtitle={
          fr
            ? "Base des réglages Admin : listes de vérification seulement. Rien sur cette page ne modifie la configuration."
            : "Admin settings foundation — readiness checklists only. Nothing on this page writes configuration."
        }
        badges={fr ? ["Prévu", "Aucune modification"] : ["Planned", "No writes"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
        {(fr ? CHECKLISTS_FR : CHECKLISTS).map((c) => (
          <Card key={c.title}>
            <CardHeader title={c.title} subtitle={c.subtitle} />
            <CardBody className="space-y-1.5">
              {c.items.map((item) => (
                <p key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <Badge tone="muted">{fr ? "Prévu" : "Planned"}</Badge> {item}
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
