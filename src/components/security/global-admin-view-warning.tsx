import { Globe2 } from "lucide-react";

/** Explicit label whenever an owner/admin sees data across all clients. */
export function GlobalAdminViewWarning() {
  return (
    <div className="flex gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
      <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
      <p className="text-xs leading-relaxed text-indigo-800">
        Vue de toute la plateforme : vous voyez les fiches de TOUS les clients parce que votre rôle est propriétaire ou administrateur. Les membres d’une équipe client ne voient jamais que leur propre client. · Global platform view — you are seeing records across ALL clients because your role is owner/admin. Client team members only ever see their own client.
      </p>
    </div>
  );
}
