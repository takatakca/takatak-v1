"use client";

import { TriangleAlert } from "lucide-react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";

/** What admin screens still cannot do, made visible on admin pages. */
export function AdminBoundaryWarning() {
  const fr = useDashboardLanguage() === "fr";
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-xs leading-relaxed text-amber-800">
        {fr
          ? "Pas encore actif sur ces écrans : lancer ou relancer une tâche, changer un rôle, inviter un utilisateur, désactiver un client, rejouer un webhook, réparer un fournisseur, envoyer une notification."
          : "Not active yet on these screens: running or retrying a job, changing a role, inviting a user, disabling a client, replaying a webhook, repairing a provider, sending a notification."}
      </p>
    </div>
  );
}
