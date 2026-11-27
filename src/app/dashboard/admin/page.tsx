import { Activity, Bell, Bot, Briefcase, Building2, CarFront, ClipboardList, HeartPulse, KeyRound, MapPinned, PackageOpen, PlugZap, Receipt, Rocket, Settings, ShoppingBag, Users } from "lucide-react";
import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminOperationCard } from "@/components/admin/admin-operation-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { AuditLogCard } from "@/components/admin/audit-log-card";
import { IntegrationEventCard } from "@/components/admin/integration-event-card";
import { JobStatusCard } from "@/components/admin/job-status-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { JOB_STATUS_LABELS, adminToneForStatus } from "@/lib/admin/status";
import { getAdminJobsData, getAdminOverviewData } from "@/lib/admin/admin-data";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const OPERATIONS = [
  { href: "/dashboard/admin/go-live", title: "Go-live checklist", description: "How close TAKATAK is to 100% in production, measured live, with exactly what closes each item.", titleFr: "Mise en service", descriptionFr: "À quel point TAKATAK est prêt à 100 % en production, mesuré en direct, avec ce qui ferme chaque point.", icon: Rocket },
  { href: "/dashboard/admin/ai", title: "AI Control Center", description: "Every AI on one screen: engines and keys, switches, credits, agents and their latest runs.", titleFr: "Centre de contrôle IA", descriptionFr: "Toutes les IA sur un écran : moteurs et clés, interrupteurs, crédits, agents et leurs derniers passages.", icon: Bot },
  { href: "/dashboard/admin/clients", title: "Clients", description: "Client accounts with brand, service, and member counts.", titleFr: "Clients", descriptionFr: "Comptes clients avec le nombre de marques, de services et de membres.", icon: Building2 },
  { href: "/dashboard/admin/users", title: "Users", description: "Profiles and client memberships.", titleFr: "Utilisateurs", descriptionFr: "Profils et appartenances aux espaces clients.", icon: Users },
  { href: "/dashboard/admin/services", title: "Services", description: "Service instances across all clients.", titleFr: "Services", descriptionFr: "Services activés pour tous les clients.", icon: Briefcase },
  { href: "/dashboard/admin/billing", title: "Billing • Facturations", description: "Ecosystem invoice queue fed by every TAKATAK app; drafts created in Facturations.", titleFr: "Facturation • Facturations", descriptionFr: "File des factures de tout l’écosystème, alimentée par chaque app TAKATAK ; brouillons créés dans Facturations.", icon: Receipt },
  { href: "/dashboard/admin/products/ahmv", title: "Product • AHMV", description: "Customers, subscriptions, revenue, entitlements and product operations.", titleFr: "Produit • AHMV", descriptionFr: "Clients, abonnements, revenus, droits d’accès et opérations du produit.", icon: PackageOpen },
  { href: "/dashboard/admin/ai-providers", title: "AI provider keys", description: "API keys for Claude, ChatGPT, Gemini and the other AI providers, with a real key test.", titleFr: "Clés des fournisseurs IA", descriptionFr: "Clés API de Claude, ChatGPT, Gemini et des autres fournisseurs IA, avec un vrai test de clé.", icon: KeyRound },
  { href: "/dashboard/admin/jobs", title: "Jobs Monitor", description: "Planned jobs and logs. No worker runs them yet.", titleFr: "Suivi des tâches", descriptionFr: "Tâches planifiées et journaux. Aucun exécuteur ne les fait encore tourner.", icon: Activity },
  { href: "/dashboard/admin/integration-events", title: "Integration Events", description: "Provider event log (webhooks, tests).", titleFr: "Événements d’intégration", descriptionFr: "Journal des événements des fournisseurs (webhooks, tests).", icon: PlugZap },
  { href: "/dashboard/admin/audit-logs", title: "Audit Logs", description: "System-internal audit trail with safe notes.", titleFr: "Journal d’audit", descriptionFr: "Piste d’audit interne avec des notes sûres.", icon: ClipboardList },
  { href: "/dashboard/admin/notifications", title: "Notifications", description: "System notifications overview.", titleFr: "Notifications", descriptionFr: "Vue d’ensemble des notifications du système.", icon: Bell },
  { href: "/dashboard/admin/system-health", title: "System Health", description: "Env, auth, provider, and capability status.", titleFr: "Santé du système", descriptionFr: "État des variables, de la connexion, des fournisseurs et des fonctions.", icon: HeartPulse },
  { href: "/dashboard/admin/rentauto", title: "Rentauto", description: "Master identity, verification, payment projection, and synchronization health.", titleFr: "Rentauto", descriptionFr: "Identité maîtresse, vérification, projection des paiements et santé de la synchronisation.", icon: CarFront },
  { href: "/dashboard/admin/qmaps", title: "QMAPS", description: "Lier une fiche QMAPS à un espace client. Confirmé seulement si QMAPS répond.", titleFr: "QMAPS", descriptionFr: "Lier une fiche QMAPS à un espace client. Confirmé seulement si QMAPS répond.", icon: MapPinned },
  { href: "/dashboard/admin/one-lv", title: "1LV", description: "Master identity, merchant projections, and synchronization health.", titleFr: "1LV", descriptionFr: "Identité maîtresse, projections des marchands et santé de la synchronisation.", icon: ShoppingBag },
  { href: "/dashboard/admin/settings", title: "Settings", description: "Readiness checklists — no writes yet.", titleFr: "Réglages", descriptionFr: "Listes de vérification : aucune modification pour l’instant.", icon: Settings },
];

export default async function AdminOverviewPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const data = await getAdminOverviewData();
  const jobs = await getAdminJobsData();
  const kpis = [
    { label: "Clients", value: data.kpis.clients, icon: Building2 },
    { label: fr ? "Membres d’équipe" : "Team Members", value: data.kpis.teamMembers, icon: Users },
    { label: fr ? "Tâches" : "Jobs", value: data.kpis.jobs, icon: Activity },
    { label: fr ? "Tâches planifiées" : "Planned Jobs", value: data.kpis.plannedJobs, icon: Activity },
    { label: fr ? "Événements d’intégration" : "Integration Events", value: data.kpis.integrationEvents, icon: PlugZap },
    { label: fr ? "Entrées d’audit" : "Audit Entries", value: data.kpis.auditEntries, icon: ClipboardList },
    { label: fr ? "Notifications non lues" : "Unread Notifications", value: data.kpis.unreadNotifications, icon: Bell },
  ];
  return (
    <div className="space-y-6">
      <AdminHeader
        title={fr ? "Tour de contrôle Admin" : "Admin Control Tower"}
        subtitle={
          fr
            ? "Dirigez TAKATAK d’ici : IA, clients, utilisateurs, facturation, intégrations, tâches, piste d’audit et santé du système."
            : "Run TAKATAK from here: AI, clients, users, billing, integrations, jobs, audit trail and system health."
        }
        badges={[fr ? "Propriétaires et administrateurs de la plateforme" : "Platform owners and admins"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />

      <section aria-label={fr ? "Indicateurs Admin" : "Admin KPIs"}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {kpis.map((k) => <AdminKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><AdminSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <section className="space-y-3" aria-label={fr ? "Opérations" : "Operations"}>
        <h2 className="text-sm font-semibold text-slate-900">{fr ? "Opérations" : "Operations"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OPERATIONS.map((op) => (
            <AdminOperationCard
              key={op.href}
              href={op.href}
              icon={op.icon}
              title={fr ? op.titleFr : op.title}
              description={fr ? op.descriptionFr : op.description}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title={fr ? "Aperçu des tâches" : "Jobs Snapshot"}
          subtitle={fr ? "Répartition par état. « En cours » est à 0, car aucun exécuteur n’existe." : "Status distribution. Running is 0 because no worker exists."}
        />
        <CardBody className="flex flex-wrap gap-2">
          {data.jobStatusCounts.map((j) => (
            <span key={j.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <Badge tone={adminToneForStatus(j.status)}>{adminFr(JOB_STATUS_LABELS[j.status] ?? j.status, fr)}</Badge> ×{j.count}
            </span>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label={fr ? "Tâches récentes" : "Recent jobs"}>
        <h2 className="text-sm font-semibold text-slate-900">{fr ? "Tâches récentes" : "Recent Jobs"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.jobs.slice(0, 2).map((j) => <JobStatusCard key={j.id} job={j} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label={fr ? "Entrées d’audit récentes" : "Recent audit entries"}>
        <h2 className="text-sm font-semibold text-slate-900">{fr ? "Entrées d’audit récentes" : "Recent Audit Entries"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recentAudit.slice(0, 2).map((a) => <AuditLogCard key={a.id} entry={a} />)}
        </div>
      </section>

      {data.recentEvents.length ? (
        <section className="space-y-3" aria-label={fr ? "Événements d’intégration récents" : "Recent integration events"}>
          <h2 className="text-sm font-semibold text-slate-900">{fr ? "Événements d’intégration récents" : "Recent Integration Events"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recentEvents.map((e) => <IntegrationEventCard key={e.id} event={e} />)}
          </div>
        </section>
      ) : null}

      <AdminBoundaryWarning />
    </div>
  );
}
