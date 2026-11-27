import Link from "next/link";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { getAdminSystemHealthData } from "@/lib/admin/admin-data";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const health = getAdminSystemHealthData();
  return (
    <div className="space-y-5">
      <AdminHeader
        title={fr ? "Santé du système" : "System Health"}
        subtitle={
          fr
            ? "Réglages de l’application, de la base de données et des fournisseurs, lus sur le serveur. Pour le portrait complet en direct et la suite à faire, utilisez la liste de mise en service."
            : "Application, database and provider settings, read from the server. For the full live picture and what to do next, use the go-live checklist."
        }
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <Link
        href="/dashboard/admin/go-live"
        className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 hover:border-blue-300"
      >
        <span>
          {fr
            ? "Liste de mise en service : chaque point mesuré en direct, avec un pourcentage et exactement ce qui ferme chacun."
            : "Go-live checklist: every item measured live, with one percentage and exactly what closes each one."}
        </span>
        <span aria-hidden>→</span>
      </Link>
      <SystemHealthPanel title="Application" items={health.app} />
      <SystemHealthPanel
        title={fr ? "Fournisseurs" : "Providers"}
        subtitle={
          fr
            ? "Présence des variables seulement. Aucun fournisseur n’est affiché « branché » avant un vrai test réussi avec ses identifiants : lancez les tests en direct sur les pages des fournisseurs, sous Intégrations."
            : "Env presence only. No provider shows Connected until a real credentialed test succeeds — run live tests on the provider pages under Integrations."
        }
        items={health.providers}
      />
      <AdminBoundaryWarning />
    </div>
  );
}
